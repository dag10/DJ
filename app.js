/* app.js
 * The entry point for the app server.
 */

var config = require('./utils/load_config') || process.exit(1);
var auth = require('./logic/auth');
var auth_module = require('./logic/web/auth');
var express = require('express');
var handlers = require('./logic/web/handlers');
var database = require('./logic/database');
var models = require('./models');
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

// Show config warnings (if any).
.then(function() {
  config.warnings.forEach(function(str) {
    winston.warn(str);
  });
})

// Initialize socket.io.
.then(function() {
  return socket.init(server);
})

// Initialize the database.
.then(database.init)

// Define models.
.then(models.init)

// Initialize authentication.
.then(auth.init)

// Do some procedural initialization steps, then do some steps concurrently.
.then(function() {

  // Initialize auth.
  var auth = auth_module.init(app);

  // Initialize the rest of these concurrently.
  return Q.all([
    song_sources.init(),
    rooms.loadRooms(),
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
});


