$(function() {
  var error = function(msg) {
    alert('Error: ' + msg);
  };

  window.Connection = Backbone.Model.extend({

    /* Model */

    defaults: {
      connected: false
    },

    initialize: function() {
      this.connect();
    },

    /* Socket Commands */

    connect: function() {
      var doConnect = _.bind(function() {
        console.log('Connecting...');

        var socket = io.connect();

        this.set({ socket: socket });
        socket.on('connect', _.bind(this.handleConnect, this));
        socket.on('disconnect', _.bind(this.handleDisconnect, this));
        socket.on('error', _.bind(this.handleError, this));
        socket.on('kick', _.bind(this.handleKick, this));
        socket.on(
          'room:num_anonymous', _.bind(this.handleNumAnonymous, this));
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
              data.connect = this;
              this.set({ room: new models.Room(data) });
            } else {
              this.get('room').set(data);
            }
          }
        }, this));
      }, this);

      if (this.has('room'))
        this.leaveRoom(join);
      else
        join();
    },

    leaveRoom: function(next) {
      this.get('socket').emit('room:leave', _.bind(function() {
        console.log('Left room.');
        if (this.has('room'))
          this.get('room').reset();
        if (_.isFunction(next)) next();
      }, this));
    },

    /* Socket Handlers */

    handleConnect: function() {
      console.log('Connected.');

      this.set({ connected: true });
      if (this.has('username') && this.has('userhash'))
        this.authenticate();
      else
        this.joinRoom();

      this.trigger('connect');
    },

    handleDisconnect: function() {
      console.log('Disconnected.');

      this.set({ connected: false });
      if (this.has('room'))
        this.get('room').reset();

      this.trigger('disconnect');
    },

    handleError: function(err) {
      error(err);
      this.disconnect();
    },

    handleKick: function(msg) {
      this.get('socket').disconnect();
      alert('You were kicked:\n' + msg);
    },

    handleNumAnonymous: function(num) {
      this.get('room').set({ anonymous_listeners: num });
    }
  });
});

