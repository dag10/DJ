/* handlers.js
 * Handlers for express web requests.
 */

var config = require('./config');
var express = require('express');

exports.init = function(app, auth) {
  app.enable('trust proxy');
  app.set('views', config.web.views_directory);
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.session({secret: Math.random() + '_'}));

  auth.initHandlers();

  app.use(function(error, req, res, next) {
    console.error(error.stack);
    res.status(500);
    res.render('error.ejs', {
      error: error,
      config: config
    });
  });

  app.get('/', function(req, res) {
    var user = auth.getUser(req, res);
    if (!user) return;

    res.render('index.ejs', {
      user: user,
      config: config
    });
  });

  app.get('/play/:room', function(req, res) {
    var user = auth.getUser(req, res);
    if (!user) return;

    res.send('You\'re playing in: ' + req.param('room'));
  });

  app.get('/listen/:room', function(req, res) {
    res.send('You\'re listening to: ' + req.param('room'));
  });
}

