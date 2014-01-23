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
  room.djConnections = [];

  // Returns an object with sendable user data for a connection.
  var connectionUserData = function(connection) {
    var user = connection.user;

    return {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      dj: connection.dj,
      djOrder: connection.djOrder,
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

  room.broadcastUserUpdate = function(user) {
    room.connections.forEach(function(conn) {
      conn.sendUpdatedUser(user);
    });
  };

  room.broadcastDJs = function() {
    room.djConnections.forEach(function(dj) {
      room.broadcastUserUpdate(connectionUserData(dj));
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
    return room.connectionsByUsername[username];
  };

  room.updateDJOrder = function() {
    for (var i = 0; i < room.djConnections.length; i++)
      room.djConnections[i].djOrder = i;
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

    if (connection.dj)
      room.endDJ(connection.user.username);

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

  room.makeDJ = function(username) {
    var conn = room.connectionsByUsername[username];
    if (!conn) return 'User not found.';
    if (conn.dj) return 'User is already DJ.';
    if (room.djConnections.length >= room.slots)
      return 'All DJ slots are full.';

    room.djConnections.push(conn);
    conn.dj = true;
    conn.djOrder = room.djConnections.length - 1;
    room.broadcastUserUpdate(connectionUserData(conn));

    winston.info(conn.user.getLogName() + ' became a DJ in: ' + room.name);
  };

  room.endDJ = function(username) {
    var conn = room.connectionsByUsername[username];
    if (!conn) return 'User not found.';
    if (!conn.dj) return 'User is not a DJ.';

    conn.dj = false;
    delete conn.djOrder;
    var i = room.djConnections.indexOf(conn);
    room.djConnections.splice(i, 1);
    room.updateDJOrder();
    room.broadcastUserUpdate(connectionUserData(conn));
    room.broadcastDJs();

    winston.info(
      conn.user.getLogName() + ' is no longer a DJ in: ' + room.name);
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

