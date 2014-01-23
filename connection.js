/* connection.js
 * Manages a socket.io connection for a user in a room.
 */

var rooms = require('./rooms');
var winston = require('winston');
var user_model = require('./models/user');
var _ = require('underscore');
var Backbone = require('backbone');

module.exports = Backbone.Model.extend({
  defaults: {
    isDJ: false
  },

  initialize: function() {
    this.on('change:socket', this.bindSocketHandlers, this);
    this.bindSocketHandlers();
  },

  bindSocketHandlers: function() {
    // Store socket in object for easier access.
    this.socket = this.get('socket');

    this.socket.on('auth', _.bind(this.handleAuthRequest, this));
    this.socket.on('room:join', _.bind(this.handleRoomJoinRequest, this));
    this.socket.on('room:leave', _.bind(this.handleRoomLeaveRequest, this));
    this.socket.on('room:dj:begin', _.bind(this.handleBeginDJ, this));
    this.socket.on('room:dj:end', _.bind(this.handleEndDJ, this));
    this.socket.on('disconnect', _.bind(this.handleDisconnect, this));
  },

  ensureAuth: function(fn) {
    if (this.has('user')) {
      return true;
    } else {
      fn({ error: 'You are not authenticated.' });
      return false;
    }
  },

  // Kicks the client from their room.
  kick: function(msg) {
    this.socket.emit('kick', msg);
    rooms.removeConnection(this);
  },

  // Sends the number of anonymous users in the room.
  sendNumAnonymous: function(num) {
    this.socket.emit('room:num_anonymous', num);
  },

  // Sends a user that joined the room.
  sendJoinedUser: function(user) {
    this.socket.emit('room:user:join', user);
  },

  // Sends a user that left the room.
  sendLeftUser: function(user) {
    this.socket.emit('room:user:leave', user);
  },

  // Sends a user that was updated.
  sendUpdatedUser: function(user) {
    this.socket.emit('room:user:update', user);
  },

  // Sends a list of all users in the room.
  sendUserList: function(users) {
    this.socket.emit('room:users', users);
  },

  /* Sockets Handlers */

  // Handle client auth request.
  handleAuthRequest: function(data, fn) {
    if (this.has('user')) {
      fn({ error: 'You are already authenticated.' });
    } else if (this.has('room')) {
      fn({ error: 'You\'re already anonymously in a room.' });
    } else if (!data.username || !data.hash) {
      fn({ error: 'Missing auth data.' });
    } else if (data.hash !== user_model.hashUser(data.username)) {
      fn({ error: 'Failed to authenticate. Please reload.' });
    } else {
      user_model.User.find(
          { username: data.username }, 1, _.bind(function(err, users) {
        if (err) {
          fn(err.message);
        } else if (users.length === 1) {
          this.set({ user: users[0] });
          winston.info(this.get('user').getLogName() + ' authed via socket!');
          fn({ success: true });
        } else {
          fn({ error: 'User not found.' });
        }
      }, this));
    }
  },

  // Handle request to join room.
  handleRoomJoinRequest: function(shortname, fn) {
    var room = rooms.getRoom(shortname);
    if (this.has('room')) {
      fn({ error: 'You are already in a room.' });
    } else if (room) {
      fn({ name: room.name, shortname: room.shortname });
      room.addConnection(this);
    } else {
      fn({ error: 'Room not found.' });
    }
  },

  // Handle request to leave room.
  handleRoomLeaveRequest: function(fn) {
    fn();
    rooms.removeConnection(this);
  },

  // Handle request to become DJ.
  handleBeginDJ: function(fn) {
    if (!this.ensureAuth(fn)) return;
    if (!this.has('room')) return { error: 'You\'re not in a room.' };

    var err = this.get('room').makeDJ(this.get('user').username);
    fn( err ? { error: err } : {} );
  },

  // Handle request to stop being a DJ.
  handleEndDJ: function(fn) {
    if (!this.ensureAuth(fn)) return;
    if (!this.has('room')) return { error: 'You\'re not in a room.' };

    var err = this.get('room').endDJ(this.get('user').username);
    fn( err ? { error: err } : {} );
  },

  // Handle client disconnect.
  handleDisconnect: function() {
    this.trigger('disconnect');

    rooms.removeConnection(this);

    if (this.has('user'))
      winston.info(this.get('user').getLogName() + ' disconnected.');
    else
      winston.info('Anonymous listener disconnected.');
  }
});

