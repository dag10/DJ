/* handlers.js
 * Handlers for express web requests.
 */

var config = require('./config');
var express = require('express');
var lessMiddleware = require('less-middleware');
var os = require('os');
var winston = require('winston');
var rooms = require('./rooms');

exports.init = function(app, auth) {
  app.enable('trust proxy');
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));

  app.use(express.bodyParser()); // TODO: Deprecated; Find alternative.
  app.use(express.cookieParser());
  app.use(express.session({secret: Math.random() + '_'}));

  var tmpDir = os.tmpDir();
  app.use(lessMiddleware({
    src: __dirname + '/less',
    dest: tmpDir,
    prefix: '/styles',
    compress: !config.web.debug,
    force: config.web.debug
  }));

  app.use('/styles', express.static(__dirname + '/styles'));
  app.use('/images', express.static(__dirname + '/images'));
  app.use('/scripts', express.static(__dirname + '/scripts'));
  app.use('/fonts', express.static(__dirname + '/fonts'));
  app.use('/styles', express.static(tmpDir));

  auth.initHandlers();

  app.get('/', function(req, res, next) {
    auth.getUser(false, req, res, next, function(user) {
      res.render('index.ejs', {
        user: user,
        config: config,
        rooms: rooms.getRooms()
      });
    });
  });

  app.get('/room/:room', function(req, res, next) {
    auth.getUser(false, req, res, next, function(user) {
      var room = rooms.getRoom(req.param('room'));
      if (!room) {
        res.render('error.ejs', {
          user: user,
          config: config,
          header: 'Room "' + req.param('room') + '" does not exist.'
        });
        return;
      }
      res.render('room.ejs', {
        user: user,
        config: config,
        room: room
      });
    });
  });

  app.use(function(err, req, res, next) {
    auth.getUser(false, req, res, next, function(user) {
      winston.error(err.stack);
      res.status(500);
      res.render('error.ejs', {
        user: user,
        error: err,
        config: config
      });
    });
  });

  app.use(function(req, res, next) {
    auth.getUser(false, req, res, next, function(user) {
      res.status(404);
      res.render('error.ejs', {
        user: user,
        header: 'Page not found: ' + req.url,
        config: config
      });
    });
  });
};

