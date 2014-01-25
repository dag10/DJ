/* app.js
 * The entry point for the app server.
 */

var auth_module = require('./logic/web/auth');
var config = require('./config');
var express = require('express');
var handlers = require('./logic/web/handlers');
var database = require('./database');
var models_module = require('./models');
var winston = require('winston');
var logging = require('./utils/logging');
var rooms = require('./rooms');
var upload = require('./upload');
var socket = require('./socket');
var http = require('http');

logging.init();

var app = express();
var server = http.createServer(app);

socket.init(server);

app.configure(function() {
  database.init(app, models_module.define, function(models) {
    rooms.once('load', function() {
      upload.init();
      handlers.init(app, auth_module.init(app));
      server.listen(config.web.port, function() {
        winston.info('Server listening on port', config.web.port);
      });
    });
    rooms.loadRooms();
  });
});

