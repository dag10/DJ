/* socket.js
 * Manages socket.io communication.
 */

var config = require('./config');
var socketio = require('socket.io');
var winston = require('winston');
var user_model = require('./models/user');
var connection = require('./connection');

exports.init = function(server) {
  var io = socketio.listen(server, {
    logger: {
      debug: winston.debug,
      info: winston.info,
      error: winston.error,
      warn: winston.warn
    }
  });

  io.configure(function() {
    io.enable('browser client minification');
    io.enable('browser client etag');
    io.enable('browser client gzip');
    io.set('heartbeat timeout', 25);
    io.set('heartbeat interval', 3);
  });

  io.sockets.on('connection', function(socket) {
    var conn = connection.createConnection(socket);
  });
};

