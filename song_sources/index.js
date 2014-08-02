/* song_sources index.js
 * Loads all local and external song source modules.
 */

var config = require('../config');
var fs = require('fs');
var os = require('os');
var winston = require('winston');
var async = require('async');
var _ = require('underscore');
var song_source_map_model = require('../models/songsourcemap');
var file_model = require('../models/file');
var song_model = require('../models/song');
var songs = require('../logic/song/songs');
var Q = require('q');
var Sequelize = require('sequelize');

// Checks whether the str ends with the suffix string.
function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Internal map of search functions for loaded sources.
var search_functions = [];

// Map of loaded song source modules. Index by module name.
exports.sources = {};

/**
 * Creates a log function that wraps a winston log function, prefixing the
 * message.
 *
 * @param prefix String to prefix messages with.
 * @param type Winston log function name to use (e.g. 'info', 'debug', etc).
 * @return Function that accepts a string and logs the prefixed string.
 */
function createLogFunction(prefix, type) {
  return function(msg) {
    winston[type](prefix + msg);
  };
}

/**
 * Creates a logging function/object for a module.
 *
 * @param module The module object.
 * @return Function with member functions to log a message prefixed by the
 *         module's name.
 */
function createLogger(module) {
  var prefix = ('[' + module.name + ']').bold + ' ';
  var logger = createLogFunction(prefix, 'info');
  logger.debug = createLogFunction(prefix, 'debug');
  logger.info = createLogFunction(prefix, 'info');
  logger.warn = createLogFunction(prefix, 'warn');
  logger.error = createLogFunction(prefix, 'error');
  return logger;
}

/**
 * Initializes a song source module.
 *
 * This function also adds the module to the modules list if it was
 * successfully initialized.
 *
 * @param Module to initialize.
 * @return Promise resolving with the module if successful, or resolving with
 *         an Error if there was an error. It does not reject the promise.
 */
function initSongSource(module) {
  var deferred = Q.defer();

  var logger = createLogger(module);

  module.init(logger, function(err) {
    if (err) {
      winston.error(
        'Failed to load song source ' + module.name +
        ': ' + err.message);
      deferred.resolve(err);
    } else {
      winston.info('Loaded song source: ' + module.name);
      module.downloadDir = os.tmpdir();
      exports.sources[module.name] = module;
      deferred.resolve(module);
    }
  });

  return deferred.promise;
}

/**
 * Creates a search function for a module.
 *
 * @param module Name of module.
 * @return Function that accepts a query string and a callback for returning
 *         a list of results.
 */
function createSearchFunction(module) {
  var max_results = config.song_sources.results_format[module.name];
  return function(query, callback) {
    module.search(
      max_results, query, function(results) {
      callback(null, results);
    });
  };
}

/**
 * Loads and initializes all local and external song sources.
 *
 * @return Promise resolving with successful initialization, or rejecting
 *         with an error.
 */
exports.init = function() {
  var deferred = Q.defer(),
      modules = [];

  // Find modules in the song_sources directory besides the index.
  fs.readdirSync('./song_sources').forEach(function(file) {
    if (!endsWith(file, '.js')) return;
    if (file == 'index.js') return;
    modules.push(require('./' + file));
  });

  // Find external modules.
  config.song_sources.external_modules.forEach(function(module_name) {
    var module = require(module_name);
    module.name = module_name;
    modules.push(module);
  });

  // Start of promise chain.
  return Q
  
  // Initialize all song source modules.
  .all(modules.map(initSongSource)).allSettled()
  .then(function() {
    var length = Object.keys(exports.sources).length;
    var plural = length == 1 ? '' : 's';
    winston.info('Loaded ' + length + ' source' + plural + '.');

    if (length === 0) {
      return Q.reject(new Error('No song sources were loaded.'));
    }
  })

  // Build internal array of search functions.
  .then(function() {
    var source_names = Object.keys(config.song_sources.results_format);
    var search_modules = source_names
    .map(function(source_name) {
      return exports.sources[source_name];
    })
    .filter(function(module) {
      return !!module;
    });

    search_functions = search_modules.map(createSearchFunction);
  });
};

// Searches all song sources.
exports.search = function(query, callback) {
  // First, we apply the search query to all the sources' search functions.
  async.map(search_functions, function(search_function, callback) {
    callback(null, async.apply(search_function, query));
  }, function(err, applied_search_functions) {
    // Then we run all the functions in parallel, waiting until they finish.
    async.parallel(applied_search_functions, function(err, result_arrays) {
      var sections = [];
      var source_names = Object.keys(config.song_sources.results_format);

      // Wrap the results objects in objects describing the song source.
      for (var i = 0; i < result_arrays.length; i++) {
        var source_name = source_names[i];
        var source = exports.sources[source_name];

        var result_objects = _.map(result_arrays[i], function(result) {
          result.source_id = result.id;
          return result;
        });

        sections.push({
          source: source.name,
          title: source.display_name,
          results: result_arrays[i]
        });
      }

      callback({
        query: query,
        sections: sections
      });
    });
  });
};

/**
 * Downloads or gets a Song entity from a song source.
 *
 * @param source Name of song source.
 * @param source_id Source-specific id string of song to fetch.
 * @return Promise resolving with the Song instance or null, or rejecting with
 *                 an error.
 */
exports.fetch = function(source, source_id) {
  return Q(song_source_map_model.Model.find({
    where: Sequelize.and(
      { source: source },
      { sourceId: source_id }
    ),
    include: [
      {
        model: song_model.Model,
        as: 'Song',
        include: [
          {
            model: file_model.Model,
            as: 'File'
          },
          {
            model: file_model.Model,
            as: 'Artwork'
          }
        ]
      }
    ]
  }))
  .then(function(song_map) {
    if (song_map) return Q(song_map.getSong());
    var deferred = Q.defer();

    _.defer(function() {
      deferred.notify(songs.stages.downloading);
    });

    Q
    .delay(1200)
    .then(function() {
      var source_module = exports.sources[source];
      if (!source_module) {
        return Q.reject(new Error('Source not found: ' + source));
      }

      var fetch_deferred = Q.defer();

      source_module.fetch(
          source_id, source_module.downloadDir, function(ret) {
        if (typeof ret === 'string') {
          var filename = ret.replace(/^.*[\\\/]/, '');
          songs
          .addSong(ret, user, filename)
          .done(
            fetch_deferred.resolve,
            fetch_deferred.reject,
            fetch_deferred.notify);
        } else {
          fetch_deferred.reject(ret);
        }
      });

      return fetch_deferred.promise;
    })
    .done(
      deferred.resolve,
      deferred.reject,
      deferred.notify);

    return deferred.promise;
  });
};

