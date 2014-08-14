/* connection.js
 * Manages a socket.io connection for a user in a room.
 */
/*jshint es5: true */

var rooms = require('../room/rooms');
var winston = require('winston');
var user_model = require('../../models/user');
var _ = require('underscore');
var Backbone = require('backbone');
var queues = require('../song/queues');
var song_sources = require('../../song_sources');
var songs = require('../song/songs');

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
    socket.on('search', _.bind(this.handleSearch, this));
    socket.on('search:add', _.bind(this.handleSearchAdd, this));
    socket.on('queue:change:order', _.bind(this.handleQueuedSongOrder, this));
    socket.on('queue:change:escalate', _.bind(this.handleEscalation, this));
    socket.on('queue:remove', _.bind(this.handleRemoveFromQueue, this));
    socket.on('skip', _.bind(this.handleSkip, this));
    socket.on('disconnect', _.bind(this.handleDisconnect, this));
    socket.on('error', _.bind(this.handleError, this));
    
    // Set our id
    this.set({ id: socket.id });
  },

  watchSongAdd: function(song_add) {
    var socket = this.socket(),
        promise = song_add.promise;

    promise.then(function(song) {
      socket.emit('song:add:added', {
        job_id: song_add.job_id,
        song_id: song.id
      });
    });

    promise.catch(function(err) {
      socket.emit('song:add:failed', {
        job_id: song_add.job_id,
        error: err.message
      });
    });

    promise.progress(function(stage) {
      socket.emit('song:add:status', {
        job_id: song_add.job_id,
        status: stage
      });
    });
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
      if (room.get('playback').playing()) {
        this.sendSongPlayback(room.get('playback'));
      }
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

  getLogName: function() {
    var user = this.user();
    return user ? user.getLogName() : null;
  },

  /* Utilities */

  ensureAuth: function(fn) {
    if (this.authenticated()) {
      return true;
    } else {
      if (typeof fn === 'function')
        fn({ error: 'You are not authenticated.' });
      return false;
    }
  },

  ensureRoom: function(fn) {
    if (this.has('room')) {
      return true;
    } else {
      if (typeof fn === 'function')
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
    queues
    .getQueue(this.user().id)
    .then(_.bind(function(ret) {
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
    queue.on('remove', function() {
      if (this.get('isDJ') && queue.length === 0) {
        var room = this.get('room');
        if (room) {
          room.endDJ(this);
        }
      }
    }, this);
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

  // Sends a room activity.
  sendRoomActivity: function(activity) {
    this.socket().emit('room:activity', activity.toJSON());
  },

  // Sends the list of room activities.
  sendRoomActivities: function(activities) {
    this.socket().emit('room:activities', activities.toJSON());
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
    if (!data || !fn) return;

    if (this.authenticated()) {
      fn({ error: 'You are already authenticated.' });
    } else if (this.has('room')) {
      fn({ error: 'You\'re already anonymously in a room.' });
    } else if (!data.username || !data.hash) {
      fn({ error: 'Missing auth data.' });
    } else if (data.hash !== user_model.Model.hashUsername(data.username)) {
      fn({ error: 'Failed to authenticate. Please reload.' });
      this.socket().disconnect();
    } else {
      user_model.Model.find({
        where: {
          username: data.username
        }
      }).success(_.bind(function(user) {
        if (user) {
          this.set({
            authenticated: true,
            user: user
          });
          winston.info(this.user().getLogName() + ' connected.');
          fn({ success: true });
          this.fetchQueue();
        } else {
          fn({ error: 'User not found.' });
        }
      }, this)).error(function(err) {
        winston.error('Error fetching user for auth request: ' + err.message);
        fn(err.message);
      });
    }
  },

  // Handle request to join room.
  handleRoomJoinRequest: function(shortname, fn) {
    if (!shortname || !fn) return;

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
    if (!fn) return;

    if (this.has('room')) {
      this.get('room').removeConnection(this);
      fn();
    } else {
      fn({ error: 'You are not in a room.' });
    }
  },

  // Handle request to become DJ.
  handleBeginDJ: function(fn) {
    if (!fn) return;

    if (!this.ensureAuth(fn)) return;
    if (!this.ensureRoom(fn)) return;

    var err = this.get('room').makeDJ(this);
    fn( err ? { error: err } : {} );
  },

  // Handle request to stop being a DJ.
  handleEndDJ: function(fn) {
    if (!fn) return;

    if (!this.ensureAuth(fn)) return;
    if (!this.ensureRoom(fn)) return;

    var err = this.get('room').endDJ(this);
    fn( err ? { error: err } : {} );
  },

  // Handle request for search results.
  handleSearch: function(query, fn) {
    if (!query || !fn) return;
    song_sources.search(query.substr(0, 50)).done(fn);
  },

  // Handle adding a search result to queue.
  handleSearchAdd: function(data, fn) {
    var source = data.source,
        source_id = data.source_id;

    var job = songs.addFromSearch(source, source_id, this.user());

    fn({ job_id: job.job_id });
    this.watchSongAdd(job);
  },

  // Handle client disconnect.
  handleDisconnect: function() {
    if (this.has('room'))
      this.get('room').removeConnection(this);

    if (this.has('user'))
      winston.info(this.user().getLogName() + ' disconnected.');
    else
      winston.info('Anonymous listener disconnected.');

    this.trigger('disconnect');
  },

  // Handle queue song order change.
  handleQueuedSongOrder: function(data, fn) {
    if (!data) return;
    if (!this.ensureAuth(fn)) return;
    this.get('queue').updateSongOrder(data[0], data[1]);
  },

  handleEscalation: function(queued_song_id, fn) {
    if (!queued_song_id) return;
    if (!this.ensureAuth(fn)) return;
    this.get('queue').escalateSong(queued_song_id);
  },

  // Handle command to skip current song.
  handleSkip: function(fn) {
    if (!this.ensureAuth(fn)) return;
    if (!this.ensureRoom(fn)) return;

    var room = this.get('room');
    if (room.getCurrentDJ() === this)
      room.playNextSong();
  },

  // Handle command to remove a song from the user's queue.
  handleRemoveFromQueue: function(queued_song_id) {
    if (!queued_song_id) return;

    var queued_song = this.get('queue').get(queued_song_id);
    if (queued_song && !queued_song.get('playing'))
      this.get('queue').remove(queued_song_id);
  },

  // Handle socket error.
  handleError: function() {
    winston.error('Socket error; disconnecting.');
    this.socket().disconnect();
  }
});

