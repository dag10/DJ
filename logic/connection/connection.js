/* connection.js
 * Manages a socket.io connection for a user in a room.
 */

var rooms = require('../room/rooms');
var winston = require('winston');
var user_model = require('../../models/user');
var _ = require('underscore');
var Backbone = require('backbone');
var queues = require('../song/queues');

module.exports = Backbone.Model.extend({
  defaults: {
    authenticated: false
  },

  initialize: function() {
    this.on('change:socket', this.bindSocketHandlers, this);
    this.bindSocketHandlers();
    this.on('change:queue', this.queueChanged, this);
    this.on('change:room', this.roomChanged, this);

    // Store username locally for faster lookups in collections
    this.on('change:user', function() {
      if (this.has('user'))
        this.set({ username: this.user().username });
    }, this);
  },

  bindSocketHandlers: function() {
    var socket = this.socket();

    socket.on('auth', _.bind(this.handleAuthRequest, this));
    socket.on('room:join', _.bind(this.handleRoomJoinRequest, this));
    socket.on('room:leave', _.bind(this.handleRoomLeaveRequest, this));
    socket.on('room:dj:begin', _.bind(this.handleBeginDJ, this));
    socket.on('room:dj:end', _.bind(this.handleEndDJ, this));
    socket.on('queue:change:order', _.bind(this.handleQueuedSongOrder, this));
    socket.on('skip', _.bind(this.handleSkip, this));
    socket.on('disconnect', _.bind(this.handleDisconnect, this));
    
    // Set our id
    this.set({ id: socket.id });
  },

  roomChanged: function() {
    var oldRoom = this.previous('room');
    if (oldRoom) {
      oldRoom.off(null, null, this);
      oldRoom.get('playback').off(null, null, this);
    }

    var room = this.get('room');
    if (room) {
      room.get('playback').on('play', function() {
        this.sendSongPlayback(room.get('playback'));
      }, this);
      room.get('playback').on('end', function() {
        this.sendSongPlaybackStopped();
      }, this);
      this.sendSongPlayback(room.get('playback'));
    }
  },

  /* Convienence Getters */

  socket: function() {
    return this.get('socket');
  },

  authenticated: function() {
    return this.get('authenticated');
  },

  user: function() {
    return this.get('user') || null;
  },

  /* Utilities */

  ensureAuth: function(fn) {
    if (this.authenticated()) {
      return true;
    } else {
      fn({ error: 'You are not authenticated.' });
      return false;
    }
  },

  ensureRoom: function(fn) {
    if (this.has('room')) {
      return true;
    } else {
      fn({ error: 'You\'re not in a room.' });
      return false;
    }
  },

  // Returns an object with sendable user data.
  userData: function() {
    var user = this.user() || {};

    return {
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: user.fullName,
      dj: this.get('isDJ') || false,
      djOrder: this.get('djOrder'),
      admin: user.admin
    };
  },

  /* Queue */

  fetchQueue: function() {
    queues.getQueue(this.user().id, _.bind(function(ret) {
      if (ret instanceof Error) {
        winston.error('Failed to fetch queue: ' + ret.message);
        this.socket().emit('error', 'Failed to get queue.');
      } else {
        this.set({ queue: ret });
      }
    }, this));
  },

  queueChanged: function() {
    var queue = this.get('queue');
    if (!queue) return;
    queue.on('reset', function() {
      this.sendQueue(queue);
    }, this);
    queue.on('songChanged add', this.sendQueuedSong, this);
    queue.on('remove', this.sendQueuedSongRemoved, this);
    this.sendQueue(queue);
  },

  /* Socket Commands */

  // Kicks the client from their room.
  kick: function(msg) {
    this.socket().emit('kick', msg);

    if (this.has('room'))
      this.get('room').removeConnection(this);
  },

  // Sends the number of anonymous users in their room.
  sendNumAnonymous: function(num) {
    this.socket().emit('room:num_anonymous', num);
  },

  // Sends a user that joined their room.
  sendJoinedUser: function(conn) {
    this.socket().emit('room:user:join', conn.userData());
  },

  // Sends a user that left their room.
  sendLeftUser: function(conn) {
    this.socket().emit('room:user:leave', conn.userData());
  },

  // Sends a user that was updated in their room.
  sendUpdatedUser: function(conn) {
    this.socket().emit('room:user:update', conn.userData());
  },

  // Sends a list of all users in their room.
  sendUserList: function(conns) {
    this.socket().emit('room:users', _.map(conns, function(conn) {
      return conn.userData();
    }));
  },

  // Sends a queue to the user.
  sendQueue: function(queue) {
    this.socket().emit('queue', queue.toJSON());
  },

  // Sends a queued song that was added or updated.
  sendQueuedSong: function(queued_song) {
    this.socket().emit('queue:song', queued_song.toJSON());
  },

  // Sends an alert that a queued song was removed from the queue.
  sendQueuedSongRemoved: function(queued_song) {
    this.socket().emit('queue:song:remove', queued_song.id);
  },

  // Sends a currently playing song.
  sendSongPlayback: function(playback) {
    this.socket().emit('room:song:update', playback.toJSON());
  },

  // Sends an indication that the playing song has stopped.
  sendSongPlaybackStopped: function() {
    this.socket().emit('room:song:stop');
  },

  /* Sockets Handlers */

  // Handle client auth request.
  handleAuthRequest: function(data, fn) {
    if (this.authenticated()) {
      fn({ error: 'You are already authenticated.' });
    } else if (this.has('room')) {
      fn({ error: 'You\'re already anonymously in a room.' });
    } else if (!data.username || !data.hash) {
      fn({ error: 'Missing auth data.' });
    } else if (data.hash !== user_model.hashUser(data.username)) {
      fn({ error: 'Failed to authenticate. Please reload.' });
      this.socket().disconnect();
    } else {
      user_model.User.find(
          { username: data.username }, 1, _.bind(function(err, users) {
        if (err) {
          fn(err.message);
        } else if (users.length === 1) {
          this.set({
            authenticated: true,
            user: users[0]
          });
          winston.info(this.user().getLogName() + ' authed via socket!');
          fn({ success: true });
          this.fetchQueue();
        } else {
          fn({ error: 'User not found.' });
        }
      }, this));
    }
  },

  // Handle request to join room.
  handleRoomJoinRequest: function(shortname, fn) {
    var room = rooms.roomForShortname(shortname);
    if (this.has('room')) {
      fn({ error: 'You are already in a room.' });
    } else if (room) {
      fn({ name: room.get('name'), shortname: room.get('shortname') });
      room.addConnection(this);
    } else {
      fn({ error: 'Room not found.' });
    }
  },

  // Handle request to leave room.
  handleRoomLeaveRequest: function(fn) {
    if (this.has('room')) {
      this.get('room').removeConnection(this);
      fn();
    } else {
      fn({ error: 'You are not in a room.' });
    }
  },

  // Handle request to become DJ.
  handleBeginDJ: function(fn) {
    if (!this.ensureAuth(fn)) return;
    if (!this.ensureRoom(fn)) return;

    var err = this.get('room').makeDJ(this);
    fn( err ? { error: err } : {} );
  },

  // Handle request to stop being a DJ.
  handleEndDJ: function(fn) {
    if (!this.ensureAuth(fn)) return;
    if (!this.ensureRoom(fn)) return;

    var err = this.get('room').endDJ(this);
    fn( err ? { error: err } : {} );
  },

  // Handle client disconnect.
  handleDisconnect: function() {
    this.trigger('disconnect');

    if (this.has('user'))
      winston.info(this.user().getLogName() + ' disconnected.');
    else
      winston.info('Anonymous listener disconnected.');
  },

  // Handle queue song order change.
  handleQueuedSongOrder: function(data, fn) {
    if (!this.ensureAuth(fn)) return;
    this.get('queue').updateSongOrder(data[0], data[1]);
  },

  // Handle command to skip current song.
  handleSkip: function(fn) {
    if (!this.ensureAuth(fn)) return;
    if (!this.ensureRoom(fn)) return;

    var room = this.get('room');
    if (room.getCurrentDJ() === this)
      room.playNextSong();
  }
});

