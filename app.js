/* app.js
 * The entry point for the app server.
 */

var colors = require('colors');
if (!require('fs').existsSync('./config.js')) {
  console.error(
    'Config file not found. Copy ' + 'config.example.js'.bold.green +
    ' to ' + 'config.js'.bold.green + ' and edit it as needed.');
  return;
}

var config = require('./config');
var auth_module = require('./logic/web/auth');
var express = require('express');
var handlers = require('./logic/web/handlers');
var database = require('./logic/database');
var models_module = require('./models');
var winston = require('winston');
var logging = require('./utils/logging');
var rooms = require('./logic/room/rooms');
var upload = require('./logic/song/upload');
var socket = require('./logic/connection/socket');
var async = require('async');
var http = require('http');
var _ = require('underscore');

logging.init();

var app = express();
var server = http.createServer(app);

socket.init(server);

async.waterfall([

  // Configure express.
  app.configure,

  // Initialize database, define models, run migrations.
  function(callback) {
    database.init(app, models_module.define, callback);
  },

  // Run these stages in parallel...
  function(callback) {
    async.parallel([

      // Load rooms.
      _.bind(rooms.loadRooms, rooms),

      // Initialize the upload handler.
      upload.init,

      // Initialize auth and url handlers.
      function(callback) {
        var auth = auth_module.init(app);
        handlers.init(app, auth, callback);
      }

    ], function() {
      callback();
    });
  },

  // Start the server.
  function(callback) {
    server.listen(config.web.port, config.web.host, 511, callback);
  }

], function(err, results) {
  winston.info('Server listening on port', config.web.port);
});

