/* handlers.js
 * Handlers for express web requests.
 */
/*jshint es5: true */

var config = require('../../config');
var auth = require('../auth');
var express = require('express');
var lessMiddleware = require('less-middleware');
var fs_ = require('../../utils/fs');
var winston = require('winston');
var Q = require('q');
var rooms = require('../room/rooms');
var upload = require('../song/upload');
var socket = require('../connection/socket');
var stream = require('stream');
var song_sources = require('../../song_sources');
var package = require('../../package.json');
var git = require('git-rev');

var base_dir = __dirname + '/../..';

exports.init = function(app) {
  app.enable('trust proxy');
  app.set('views', base_dir + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));

  app.use(express.urlencoded({
    limit: config.web.max_file_size + 'mb'
  }));
  app.use(express.cookieParser());
  app.use(express.session({secret: Math.random() + config.web.secret }));

  var tmpDir = fs_.createTmpDir();
  app.use(lessMiddleware({
    src: base_dir + '/less',
    dest: tmpDir,
    prefix: '/styles',
    compress: config.web.compress_css,
    force: config.web.debug
  }));

  app.use('/styles', express.static(base_dir + '/static/styles'));
  app.use('/images', express.static(base_dir + '/static/images'));
  app.use('/scripts', express.static(base_dir + '/static/scripts'));
  app.use('/fonts', express.static(base_dir + '/static/fonts'));
  app.use('/styles', express.static(tmpDir));
  app.use('/artwork', express.static(upload.artwork_dir));
  app.use('/songs', express.static(upload.song_dir));

  var default_objects = {
    package: package,
    config: config,
    rooms: rooms,
    git: {},
  };

  // Get git information for template context.
  var gitLogDeferred = Q.defer();
  var gitBranchDeferred = Q.defer();
  var gitCommitDeferred = Q.defer();

  git.log(function(log) {
    default_objects.git.log = log;
    gitLogDeferred.resolve();
  });
  
  git.branch(function(branch) {
    default_objects.git.branch = branch;
    gitBranchDeferred.resolve();
  });

  git.long(function(hash) {
    default_objects.git.hash = hash;
    gitCommitDeferred.resolve();
  });


  function renderResult(res, template, objects) {
    var objs = {};

    // Copy default template objects.
    Object.keys(default_objects).forEach(function(key) {
      objs[key] = default_objects[key];
    });

    // Copy new template objects.
    Object.keys(objects).forEach(function(key) {
      objs[key] = objects[key];
    });

    // Return rendered template.
    res.render(template, objs);
  }

  default_objects.auth_urls = auth.createWebHandlers(app, renderResult);
  upload.createWebHandlers(app);

  function renderAuthFailure(res, err) {
    renderResult(res, 'error.ejs', {
      header: 'Authentication failed unexpectedly.',
      error: err,
    });
  }

  app.get('/', function(req, res, next) {
    auth.getSessionUser(req, res)
    .catch(renderAuthFailure)
    .then(function(user) {
      renderResult(res, 'index.ejs', {
        user: user,
      });
    });
  });

  app.get('/room/:room', function(req, res, next) {
    auth.getSessionUser(req, res)
    .catch(renderAuthFailure)
    .then(function(user) {
      var room = rooms.roomForShortname(req.param('room'));
      var search_sections = [];
      Object.keys(config.song_sources.results_format).forEach(function(name) {
        var source = song_sources.sources[name];
        if (source) {
          search_sections.push({
            name: source.name,
            display_name: source.display_name
          });
        }
      });
      if (room) {
        renderResult(res, 'room.ejs', {
          room: room,
          user: user,
          userhash: user ? user.hash() : '',
          search_sections: search_sections,
        });
      } else {
        res.status(404);
        renderResult(res, 'error.ejs', {
          header: 'Room "' + req.param('room') + '" does not exist.'
        });
      }
    });
  });

  app.get('/stream/:room/all', function(req, res, next) {
    var room = rooms.roomForShortname(req.param('room'));
    if (room) {
      var playback = room.playback();
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      var write_segment = function(data) {
        res.write(data);
      };
      playback.on('segment', write_segment, this);
      var end = function() {
        playback.off('segment', write_segment);
        res.end();
        res.destroy();
      };
      res.on('end', end);
      res.on('error', end);
      res.on('close', end);
      res.on('timeout', end);
    } else {
      res.status(404);
      res.end('Room not found: ' + req.param('room'));
    }
  });


  app.get('/stream/:room/current', function(req, res, next) {
    var room = rooms.roomForShortname(req.param('room'));
    if (room) {
      var playback = room.playback();

      // Send headers, prevent cache.
      res.set({
        'Content-Type': 'audio/mpeg',
        'Connection': 'close',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      var segment_index = playback.get('played_segments');
      var ended = false;

      // Create a pass-through stream that pipes to the response. This is
      // needed because res's write() isn't exactly the same as stream write().
      var res_stream = new stream.PassThrough();
      res_stream.pipe(res);

      // Function to end everything.
      var end = function() {
        ended = true;
        res_stream.end();
        if (res_stream.writable) {
          res.once('finish', res.destroy);
          res.end(new Buffer(0)); // send last-chunk
        }
        playback.off('segments_loaded', send_segments);
      };

      // Function to totally destroy the connection.
      var destroy = function() {
        end();
        res.destroy();
      };

      // Function to send as many segments as possible until the stream
      // fills up, or we sent as many segments that have been loaded so far.
      var send_segments = function() {
        if (!playback.song()) {
          end();
        }

        var segments = playback.segments();
        var segments_sent = 0;

        while (!ended) {
          // Send at most 10 segments at a time.
          if (segments_sent++ > 10) {
            setTimeout(send_segments, 0);
            break;
          }

          if (segment_index < segments.length) {
            // We increment the segment before the write attempt because
            // even if the write attempt "fails", the segement will still be
            // in the queue to send. If we send it again (by not incrementing),
            // the user will hear segments repeat.
            segment_index++;
            if (!res_stream.write(segments[segment_index - 1].data)) {
              res_stream.once('drain', send_segments);
              break;
            }
          } else if (playback.get('segments_loaded')) {
            end();
            break;
          } else {
            playback.once('segment_load', send_segments);
            break;
          }
        }
      };

      // Events for which we end everything.
      res.on('end', end);
      res.on('close', end);
      res.on('error', destroy);
      res.on('timeout', destroy);

      playback.once('segments_loaded', send_segments);
      send_segments();
    } else {
      res.status(404);
      res.end('Room not found: ' + req.param('room'));
    }
  });

  app.use(function(err, req, res, next) {
    auth.getSessionUser(req, res)
    .catch(renderAuthFailure)
    .then(function(user) {
      res.status(500);
      if (req.accepts('text/html')) {
        renderResult(res, 'error.ejs', {
          error: err,
        });
      } else if (req.accepts('application/json')) {
        res.json({ error: err.message });
      } else {
        res.send(err.message);
        res.end();
      }
    });
  });

  app.use(function(req, res, next) {
    auth.getSessionUser(req, res)
    .catch(renderAuthFailure)
    .then(function(user) {
      res.status(404);
      var err_msg = 'Page not found: ' + req.url;
      if (req.accepts('text/html')) {
        renderResult(res, 'error.ejs', {
          header: err_msg,
        });
      } else if (req.accepts('application/json')) {
        res.json({ error: err_msg });
      } else {
        res.send(err_msg);
        res.end();
      }
    });
  });

  return Q.allSettled([gitLogDeferred, gitCommitDeferred, gitBranchDeferred]);
};

