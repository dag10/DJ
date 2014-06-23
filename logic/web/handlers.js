/* handlers.js
 * Handlers for express web requests.
 */

var config = require('../../config');
var express = require('express');
var lessMiddleware = require('less-middleware');
var os = require('os');
var winston = require('winston');
var Q = require('q');
var rooms = require('../room/rooms');
var upload = require('../song/upload');
var socket = require('../connection/socket');
var stream = require('stream');
var song_sources = require('../../song_sources');

var base_dir = __dirname + '/../..';

exports.init = function(app, auth) {
  var deferred = Q.defer();

  app.enable('trust proxy');
  app.set('views', base_dir + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));

  app.use(express.urlencoded({
    limit: config.web.max_file_size + 'mb'
  }));
  app.use(express.cookieParser());
  app.use(express.session({secret: Math.random() + '_'}));

  var tmpDir = os.tmpDir();
  app.use(lessMiddleware({
    src: base_dir + '/less',
    dest: tmpDir,
    prefix: '/styles',
    compress: !config.web.debug,
    force: config.web.debug
  }));

  app.use('/styles', express.static(base_dir + '/styles'));
  app.use('/images', express.static(base_dir + '/images'));
  app.use('/scripts', express.static(base_dir + '/scripts'));
  app.use('/fonts', express.static(base_dir + '/fonts'));
  app.use('/styles', express.static(tmpDir));
  app.use('/artwork', express.static(upload.artwork_dir));
  app.use('/songs', express.static(upload.song_dir));

  auth.initHandlers();
  upload.initHandlers(app, auth);

  app.get('/', function(req, res, next) {
    auth.getUser(false, req, res, next, function(user) {
      res.render('index.ejs', {
        user: user,
        config: config,
        rooms: rooms
      });
    });
  });

  app.get('/room/:room', function(req, res, next) {
    auth.getUser(false, req, res, next, function(user) {
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
        res.render('room.ejs', {
          user: user,
          config: config,
          userhash: user ? user.hash() : '',
          search_sections: search_sections,
          room: room
        });
      } else {
        res.status(404);
        res.render('error.ejs', {
          user: user,
          config: config,
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

      var segments_sent = playback.get('played_segments');
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
        var segments = playback.segments();
        var played_segments = playback.get('played_segments');
        if (!playback.song()) {
          end();
        }

        while (!ended) {
          var index = segments_sent - played_segments;
          if (index < 0) index = 0;
          if (index < segments.length) {
            segments_sent++;
            if (!res_stream.write(segments[index].data)) {
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
    auth.getUser(false, req, res, next, function(user) {
      res.status(500);
      if (req.accepts('text/html')) {
        res.render('error.ejs', {
          user: user,
          error: err,
          config: config
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
    auth.getUser(false, req, res, next, function(user) {
      res.status(404);
      var err_msg = 'Page not found: ' + req.url;
      if (req.accepts('text/html')) {
        res.render('error.ejs', {
          user: user,
          header: err_msg,
          config: config
        });
      } else if (req.accepts('application/json')) {
        res.json({ error: err_msg });
      } else {
        res.send(err_msg);
        res.end();
      }
    });
  });

  deferred.resolve();
  return deferred.promise;
};

