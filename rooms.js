/* rooms.js
 * Manages active rooms.
 */

var winston = require('winston');

var models;
var rooms = [];
var roomsByShortname = {};
var connectionsByUsername = {};

exports.init = function(_models, next) {
  secret = Math.random();
  models = _models;
  models.room.find({}, function(err, roomResults) {
    roomResults.forEach(function(room) {
      exports.addRoom(room);
    });
    next();
  });
};

exports.addRoom = function(room) {
  room.connectionsByUsername = {};
  room.connections = [];
  room.num_anonymous = 0;

  var updateNumAnonymous = function(num) {
    room.num_anonymous = num;
    room.connections.forEach(function(conn) {
      conn.sendNumAnonymous(num);
    });
  };

  room.numUsers = function() {
    return Object.keys(room.connectionsByUsername).length;
  };

  room.getConnection = function(username) {
    return connectionsByUsername[username];
  };

  room.addConnection = function(connection) {
    connection.room = room;
    room.connections.push(connection);
    connection.sendNumAnonymous(room.num_anonymous);

    if (connection.user) {
      var user = connection.user;
      var oldconn = connectionsByUsername[user.username];
      if (oldconn) oldconn.kick('You have joined another room: ' + room.name);

      connectionsByUsername[user.username] = connection;
      room.connectionsByUsername[user.username] = connection;

      winston.info(user.getLogName() + ' joined room: ' + room.name);
    } else {
      winston.info('An anonymous listener joined room: ' + room.name);
      updateNumAnonymous(room.num_anonymous + 1);
    }
  };

  room.removeConnection = function(connection) {
    if (!connection.room || connection.room != room) return;
    connection.room = null;

    var i = room.connections.indexOf(connection);
    if (i >= 0) room.connections.splice(i, 1);
    else winston.error('hrmm');

    if (connection.user) {
      delete connectionsByUsername[connection.user.username];
      delete room.connectionsByUsername[connection.user.username];

      winston.info(connection.user.getLogName() + ' left room: ' + room.name);
    } else {
      winston.info('An anonymous listener left room: ' + room.name);
      updateNumAnonymous(room.num_anonymous - 1);
    }
  };

  rooms.push(room);
  roomsByShortname[room.shortname] = room;
};

exports.getRoom = function(shortname) {
  if (shortname in roomsByShortname)
    return roomsByShortname[shortname];
  else
    return null;
};

exports.getRooms = function() {
  return rooms;
};

exports.removeConnection = function(connection) {
  if (connection.room)
    connection.room.removeConnection(connection);
};

