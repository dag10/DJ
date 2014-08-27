/* song_sources index.js
 * Loads all local and external song source modules.
 */
/*jshint es5: true */

var config = require('../config');
var fs = require('fs');
var fs_ = require('../utils/fs');
var os = require('os');
var winston = require('winston');
var _ = require('underscore');
var song_source_map_model = require('../models/songsourcemap');
var file_model = require('../models/file');
var song_model = require('../models/song');
var songs = require('../logic/song/songs');
var Q = require('q');
var Sequelize = require('sequelize');

// Internal map of search functions for loaded sources.
var search_functions = [];

// Map of loaded song source modules. Index by module name.
exports.sources = {};

/**
 * Checks whether the str ends with the suffix string.
 *
 * @param str String to test.
 * @param suffix Suffix to test for.
 * @return True if str ends with suffix.
 */
function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

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
 * Gets the configuration object for a module, if any.
 *
 * @param module The module object.
 * @return Configuration object for the module. If no config is found, an
 *         empty object is returned.
 */
function getConfig(module) {
  return config.song_sources.configurations[module.name] || {};
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
  return module
  .init(createLogger(module), getConfig(module))
  .then(function() {
    winston.info('Loaded song source: ' + module.name);
    module.downloadDir = fs_.createTmpDir();
    module.metadataCache = {};
    exports.sources[module.name] = module;
    return Q(module);
  })
  .catch(function(err) {
    winston.error(
      'Failed to load song source ' + module.name +
      ': ' + err.message);
  });
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
  return function(query) {
    return module.search(max_results, query);
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
  .allSettled(modules.map(initSongSource))
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

/**
 * Searches all song sources.
 *
 * @param query Search query.
 * @return Promise resolving with list of search result objects.
 */
exports.search = function(query) {
  return Q.allSettled(search_functions.map(function(search_function) {
    var deferred = Q.defer();

    search_function(query)
    .then(function(result) {
      deferred.resolve(result || []);
    })
    .catch(deferred.reject);

    return deferred.promise;
  }))
  .then(function(results) {
    var sections = [];

    var source_names = Object.keys(
        config.song_sources.results_format).filter(function(source_name) {
      return !!exports.sources[source_name];
    });

    var search_modules = source_names
    .map(function(source_name) {
      return exports.sources[source_name];
    })
    .filter(function(module) {
      return !!module;
    });

    for (var i = 0; i < results.length; i++) {
      var result = results[i];
      var source_name = source_names[i];
      var source = exports.sources[source_name];

      if (result.state !== 'fulfilled') {
        winston.warn(
          'Search for ' + source_name + ' failed for "' + query + '": ' +
          result.reason);
        continue;
      }

      result.value.forEach(function(metadata) {
        source.metadataCache[metadata.id] = metadata;
      });

      sections.push({
        source: source.name,
        title: source.display_name,
        results: result.value
      });
    }

    return Q({
      query: query,
      sections: sections
    });
  });
};

/**
 * Downloads or gets a Song entity from a song source.
 *
 * @param source Name of song source.
 * @param source_id Source-specific id string of song to fetch.
 * @param job Job object containing a job_id and promise.
 * @param user Optional user object, if a user triggered this fetch.
 * @return Promise resolving with the Song instance or null, or rejecting with
 *                 an error.
 */
exports.fetch = function(source, source_id, job, user) {
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

    var source_module = exports.sources[source];
    if (!source_module) {
      return Q.reject(new Error('Source not found: ' + source));
    }

    var metadata = source_module.metadataCache[source_id];
    if (!metadata) {
      return Q.reject(new Error(
        source_module.name + ' metadata for ID ' + source_id +
        ' not found in metadata cache.'));
    }

    source_module
    .fetch(source_id, source_module.downloadDir)
    .then(function(path) {
      var filename = path.replace(/^.*[\\\/]/, '');
      var opts = {
        source: source,
        source_id: source_id,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        image_url: metadata.image_url,
      };
      return songs.processSong(path, user, filename, opts);
    })
    .done(
      deferred.resolve,
      deferred.reject,
      deferred.notify);

    return deferred.promise;
  });
};

