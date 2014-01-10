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

  // Returns an object with sendable user data for a connection.
  var connectionUserData = function(connection) {
    var user = connection.user;

    return {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      dj: connection.dj,
      admin: user.admin
    };
  };

  room.broadcastNumAnonymous = function() {
    var num = room.getNumAnonymous();
    room.connections.forEach(function(conn) {
      conn.sendNumAnonymous(num);
    });
  };

  room.broadcastUserJoined = function(user) {
    room.connections.forEach(function(conn) {
      conn.sendJoinedUser(user);
    });
  };

  room.broadcastUserLeft = function(user) {
    room.connections.forEach(function(conn) {
      conn.sendLeftUser(user);
    });
  };

  room.broadcastUserUpdates = function(user) {
    room.connections.forEach(function(conn) {
      conn.sendUpdatedUser(user);
    });
  };

  room.getUserList = function() {
    var users = [];

    Object.keys(room.connectionsByUsername).forEach(function(username) {
      users.push(connectionUserData(room.connectionsByUsername[username]));
    });

    return users;
  };

  room.numUsers = function() {
    return Object.keys(room.connectionsByUsername).length;
  };

  room.getNumAnonymous = function() {
    var num_users = Object.keys(room.connectionsByUsername).length;
    var num_total = room.connections.length;
    return num_total - num_users;
  };

  room.getConnection = function(username) {
    return connectionsByUsername[username];
  };

  room.addConnection = function(connection) {
    connection.room = room;
    room.connections.push(connection);
    connection.dj = false;

    if (connection.user) {
      var user = connection.user;
      var oldconn = connectionsByUsername[user.username];
      if (oldconn) oldconn.kick('You have joined another room: ' + room.name);

      connectionsByUsername[user.username] = connection;
      room.connectionsByUsername[user.username] = connection;

      winston.info(user.getLogName() + ' joined room: ' + room.name);
      room.broadcastUserJoined(connectionUserData(connection));
    } else {
      winston.info('An anonymous listener joined room: ' + room.name);
      room.broadcastNumAnonymous();
    }

    connection.sendUserList(room.getUserList());
    connection.sendNumAnonymous(room.getNumAnonymous());
  };

  room.removeConnection = function(connection) {
    if (!connection.room || connection.room != room) return;
    connection.room = null;
    connection.dj = false;

    var i = room.connections.indexOf(connection);
    room.connections.splice(i, 1);

    if (connection.user) {
      delete connectionsByUsername[connection.user.username];
      delete room.connectionsByUsername[connection.user.username];

      winston.info(connection.user.getLogName() + ' left room: ' + room.name);
      room.broadcastUserLeft(connectionUserData(connection));
    } else {
      winston.info('An anonymous listener left room: ' + room.name);
      room.broadcastNumAnonymous();
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

