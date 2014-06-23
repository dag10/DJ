/* app.js
 * The entry point for the app server.
 */

var config = require('./utils/load_config') || process.exit(1);
var auth_module = require('./logic/web/auth');
var express = require('express');
var handlers = require('./logic/web/handlers');
var database = require('./logic/database');
var models_module = require('./models');
var song_sources = require('./song_sources');
var winston = require('winston');
var logging = require('./utils/logging');
var rooms = require('./logic/room/rooms');
var upload = require('./logic/song/upload');
var socket = require('./logic/connection/socket');
var http = require('http');
var Q = require('q');

// Long stack support has a performance hit, so only use when debugging.
Q.longStackSupport = config.debug;

// Create the Express app and http server.
var app = express();
var server = http.createServer(app);

// Initialize logging.
logging.init()

// Initialize socket.io.
.then(function() {
  return socket.init(server);
})

// Initialize the database.
.then(function() {
  return database.init(app, models_module.define);
})

// Do some procedural initialization steps, then do some steps concurrently.
.then(function() {

  // Start loading rooms.
  var rooms_deferred = Q.defer();
  rooms.once('load', rooms_deferred.resolve);
  rooms.loadRooms();

  // Initialize auth.
  var auth = auth_module.init(app);

  // Initialize the rest of these concurrently.
  return Q.all([
    song_sources.init(),
    rooms_deferred.promise,
    upload.init(),
    handlers.init(app, auth)
  ]);
})

// Start the Express server.
.then(function() {
  return Q.ninvoke(server, 'listen', config.web.port, config.web.host, 511);
})

// After all is initialized, or after a step raises an error...
.done(function() {
  winston.info('Server listening on port', config.web.port);
}, function(err) {
  winston.error('Failed to initialize: ' + err.message);
  throw err;
});


