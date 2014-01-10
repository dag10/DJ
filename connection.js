/* connection.js
 * Manages a socket.io connection for a user in a room.
 */

var rooms = require('./rooms');
var winston = require('winston');
var user_model = require('./models/user');

exports.createConnection = function(socket) {
  var conn = { socket: socket };

  /* Utilities */

  var ensureAuth = function(fn) {
    if (conn.user) {
      return true;
    } else {
      fn({ error: 'You are not authenticated.' });
      return false;
    }
  };

  /* Commands */

  // Kicks the client, then terminates the connection.
  conn.kick = function(msg) {
    socket.emit('kick', msg);
    socket.disconnect();
  };

  // Sends the number of anonymous users in the room.
  conn.sendNumAnonymous = function(num) {
    conn.socket.emit('room:num_anonymous', num);
  };

  // Sends a user that joined the room.
  conn.sendJoinedUser = function(user) {
    conn.socket.emit('room:user:join', user);
  };

  // Sends a user that left the room.
  conn.sendLeftUser = function(user) {
    conn.socket.emit('room:user:leave', user);
  };

  // Sends a user that was updated.
  conn.sendUpdatedUser = function(user) {
    conn.socket.emit('room:user:update', user);
  };

  // Sends a list of all users in the room.
  conn.sendUserList = function(users) {
    conn.socket.emit('room:users', users);
  };

  /* Sockets Handlers */

  // Handle client auth request.
  socket.on('auth', function(data, fn) {
    if (conn.user) {
      fn({ error: 'You are already authenticated.' });
    } else if (conn.room) {
      fn({ error: 'You\'re already anonymously in a room.' });
    } else if (!data.username || !data.hash) {
      fn({ error: 'Missing auth data.' });
    } else if (data.hash !== user_model.hashUser(data.username)) {
      fn({ error: 'Failed to authenticate. Please reload.' });
    } else {
      user_model.User.find(
          { username: data.username }, 1, function(err, users) {
        if (err) {
          fn(err.message);
        } else if (users.length === 1) {
          conn.user = users[0];
          winston.info(conn.user.getLogName() + ' authed via socket!');
          fn({ success: true });
        } else {
          fn({ error: 'User not found.' });
        }
      });
    }
  });

  // Handle request to join room.
  socket.on('room:join', function(shortname, fn) {
    var room = rooms.getRoom(shortname);
    if (conn.room) {
      fn({ error: 'You are already in a room.' });
    } else if (room) {
      fn({ name: room.name, shortname: room.shortname });
      room.addConnection(conn);
    } else {
      fn({ error: 'Room not found.' });
    }
  });

  // Handle request to leave room.
  socket.on('room:leave', function(fn) {
    fn();
    rooms.removeConnection(conn);
  });

  // Handle request to become DJ.
  socket.on('room:dj:begin', function(fn) {
    if (!ensureAuth(fn)) return;
    if (!conn.room) return { error: 'You\'re not in a room.' };

    var err = conn.room.makeDJ(conn.user.username);
    fn( err ? { error: err } : {} );
  });

  // Handle request to stop being a DJ.
  socket.on('room:dj:end', function(fn) {
    if (!ensureAuth(fn)) return;
    if (!conn.room) return { error: 'You\'re not in a room.' };

    var err = conn.room.endDJ(conn.user.username);
    fn( err ? { error: err } : {} );
  });

  // Handle client disconnect.
  socket.on('disconnect', function() {
    rooms.removeConnection(conn);

    if (conn.user)
      winston.info(conn.user.getLogName() + ' disconnected.');
    else
      winston.info('Anonymous listener disconnected.');
  });

  return conn;
};

