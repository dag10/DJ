/* handlers.js
 * Handlers for express web requests.
 */

var config = require('../../config');
var express = require('express');
var lessMiddleware = require('less-middleware');
var os = require('os');
var winston = require('winston');
var rooms = require('../room/rooms');
var upload = require('../song/upload');
var socket = require('../connection/socket');

var base_dir = __dirname + '/../..';

exports.init = function(app, auth) {
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
      if (room) {
        res.render('room.ejs', {
          user: user,
          config: config,
          userhash: user ? user.hash() : '',
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

  app.get('/stream/:room', function(req, res, next) {
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
};

