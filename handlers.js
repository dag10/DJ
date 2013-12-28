/* handlers.js
 * Handlers for express web requests.
 */

var config = require('./config');
var express = require('express');
var lessMiddleware = require('less-middleware');
var os = require('os');

exports.init = function(app, auth) {
  app.enable('trust proxy');
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.engine('ejs', require('ejs-locals'));

  app.use(express.bodyParser());
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
  app.use('/scripts', express.static(__dirname + '/scripts'));
  app.use('/fonts', express.static(__dirname + '/fonts'));
  app.use('/styles', express.static(tmpDir));

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

