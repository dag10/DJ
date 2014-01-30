$(function() {
  var error = function(msg) {
    console.error(msg);
    $('.room-alert').text('Error: ' + msg);
  };

  var headerErrorTimeout = {};
  var headerError = function(header, msg) {
    if (headerErrorTimeout[header])
      clearTimeout(headerErrorTimeout[header]);

    var $error = header.find('.error');
    $error.text(msg).slideDown();

    headerErrorTimeout[header] = setTimeout(function() {
      delete headerErrorTimeout[header];
      $error.slideUp(function() {
        $error.text('');
      });
    }, 4000);
  };

  window.Connection = Backbone.Model.extend({

    /* Model */

    defaults: {
      connected: false,
      reconnect_attempts: 0,
      queue: new models.Queue()
    },

    initialize: function() {
      this.get('queue').on('changeOrder', function(data) {
        var queued_song = data[0];
        var order = data[1];
        this.sendQueuedSongOrder(queued_song.id, order);
      }, this);
      this.connect();
    },

    /* Socket Commands */

    connect: function() {
      var doConnect = _.bind(function() {
        console.log('Connecting...');

        var socket = io.connect();

        this.set({ socket: socket });
        socket.on('connect', _.bind(this.handleConnect, this));
        socket.on(
          'connect_failed', _.bind(this.handleConnectFailed, this));
        socket.on(
          'reconnect_failed', _.bind(this.handleConnectFailed, this));
        socket.on('reconnecting', _.bind(this.handleReconnecting, this));
        socket.on('disconnect', _.bind(this.handleDisconnect, this));
        socket.on('error', _.bind(this.handleError, this));
        socket.on('kick', _.bind(this.handleKick, this));
        socket.on(
          'room:num_anonymous', _.bind(this.handleNumAnonymous, this));
        socket.on('room:user:join', _.bind(this.handleUserJoin, this));
        socket.on('room:user:leave', _.bind(this.handleUserLeave, this));
        socket.on('room:user:update', _.bind(this.handleUserUpdate, this));
        socket.on('room:users', _.bind(this.handleUserList, this));
        socket.on('queue', _.bind(this.handleQueue, this));
        socket.on('queue:song', _.bind(this.handleQueuedSong, this));
        socket.on(
          'queue:song:remove', _.bind(this.handleQueuedSongRemoved, this));
      }, this);

      if (this.get('connected')) {
        this.once('disconnected', doConnect);
        this.disconnect();
      } else {
        doConnect();
      }
    },

    disconnect: function() {
      if (this.get('connected'))
        this.get('socket').disconnect();
    },

    authenticate: function() {
      var socket = this.get('socket');
      socket.emit('auth', {
        username: this.get('username'),
        hash: this.get('userhash')
      }, _.bind(function(data) {
        if (data.error) {
          error(data.error);
          socket.disconnect();
        } else {
          console.log('Authenticated.');
          this.joinRoom();
        }
      }, this));
    },

    joinRoom: function(shortname) {
      if (shortname)
        this.set({ room_shortname: shortname });

      var join = _.bind(function() {
        this.get('socket').emit(
            'room:join', this.get('room_shortname'), _.bind(function(data) {
          if (data.error) {
            this.handleError(data.error);
          } else {
            console.log('Joined room: ' + data.name);
            data.connected = true;
            if (!this.has('room')) {
              data.connection = this;
              this.set({ room: new models.Room(data) });
            } else {
              this.get('room').set(data);
            }
          }
        }, this));
      }, this);

      if (this.has('room') && this.get('room').get('connected')) {
        this.get('room').once('change:connected', join);
        this.leaveRoom();
      } else {
        join();
      }
    },

    leaveRoom: function() {
      this.get('socket').emit('room:leave', _.bind(function(err) {
        if (err) {
          error(err.error);
        } else {
          console.log('Left room.');
          if (this.has('room'))
            this.get('room').reset();
        }
      }, this));
    },

    beginDJ: function() {
      this.get('socket').emit('room:dj:begin', _.bind(function(data) {
        if (data.error)
          headerError($('#dj-header'), data.error);
      }, this));
    },

    endDJ: function() {
      this.get('socket').emit('room:dj:end', _.bind(function(data) {
        if (data.error)
          headerError($('#dj-header'), data.error);
      }, this));
    },

    sendQueuedSongOrder: function(queued_song_id, order) {
      this.get('socket').emit('queue:change:order', [
        queued_song_id,
        order
      ]);
    },

    /* Socket Handlers */

    handleConnect: function() {
      console.log('Connected.');

      this.get('queue').reset();

      this.set({
        connected: true,
        reconnect_attempts: 0
      });
      if (this.has('username') && this.has('userhash'))
        this.authenticate();
      else
        this.joinRoom();

      this.trigger('connect');
    },

    handleConnectFailed: function() {
      error('Failed to connect to server.');
    },

    handleDisconnect: function() {
      console.log('Disconnected.');

      this.get('queue').reset();
      this.set({ connected: false });
      if (this.has('room'))
        this.get('room').reset();

      this.trigger('disconnect');
    },

    handleReconnecting: function() {
      var attempts = this.get('reconnect_attempts') + 1;
      $('.room-alert').text(
        'Disconnected. Attempting to reconnect. (' + attempts + ')');
      this.set({ reconnect_attempts: attempts });

      // Constant reconnection attempt interval, unlimited attempts.
      this.get('socket').socket.reconnectionDelay = 5000;
      this.get('socket').socket.reconnectionAttempts = 1;
    },

    handleError: function(err) {
      console.error('Received error:', err);
      error(err);
    },

    handleKick: function(msg) {
      if (this.has('room')) {
        this.get('room').reset();
        this.get('room').set({ kick_message: msg || 'No reason supplied.' });
      }
    },

    handleNumAnonymous: function(num) {
      this.get('room').set({ anonymous_listeners: num });
    },

    handleUserJoin: function(user) {
      this.get('room').addUser(user);
    },

    handleUserLeave: function(user) {
      this.get('room').removeUser(user.username);
    },

    handleUserUpdate: function(user) {
      this.get('room').getUser(user.username).set(user);
    },

    handleUserList: function(users) {
      var room = this.get('room');
      room.setUsers(users);
    },

    handleQueue: function(queued_songs) {
      var queue = this.get('queue');
      queue.trigger('update:start');
      queue.reset();
      queued_songs.forEach(_.bind(function(song) {
        queue.add(song);
      }, this));
      queue.trigger('update:finish');
    },

    handleQueuedSong: function(queued_song) {
      this.get('queue').addOrUpdate(queued_song);
    },

    handleQueuedSongRemoved: function(queued_song_id) {
      var queue = this.get('queue');
      queue.remove(queue.get(queued_song_id));
    }
  });
});

