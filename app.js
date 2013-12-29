/* app.js
 * The entry point for the app server.
 */

var auth_module = require('./auth');
var config = require('./config');
var express = require('express');
var handlers = require('./handlers');
var database = require('./database');
var models_module = require('./models');
var winston = require('winston');
var fs = require('fs');

var app = express();

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  colorize: true,
  timestamp: true
});

var now = new Date();
fs.mkdir('./logs');
winston.add(winston.transports.File, {
  filename: (
      'logs/' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' +
      now.getDate() + '.txt')
});

app.configure(function() {
  database.init(app, models_module.define);
  var auth = auth_module.init(app);
  handlers.init(app, auth);
});

app.listen(config.web.port, function() {
  winston.info('Server listening on port', config.web.port);
});

