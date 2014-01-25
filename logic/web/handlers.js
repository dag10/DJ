/* handlers.js
 * Handlers for express web requests.
 */

var config = require('../../config');
var express = require('express');
var lessMiddleware = require('less-middleware');
var os = require('os');
var winston = require('winston');
var rooms = require('../../rooms');
var upload = require('../../upload');
var socket = require('../../socket');

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
        res.render('error.ejs', {
          user: user,
          config: config,
          header: 'Room "' + req.param('room') + '" does not exist.'
        });
      }
    });
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

