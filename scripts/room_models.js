$(function() {
  var models = window.models = {};

  var progressInterval = 10;

  models.Song = Backbone.Model.extend({
    defaults: {
      title: 'Unknown'
    }
  });

  models.Playback = Backbone.Model.extend({
    defaults: {
      progress: 0
    },

    initialize: function() {
      this.on('change:song', this.songChanged, this);
    },

    reset: function() {
      this.unset('song');
    },

    songChanged: function() {
      var song = this.get('song');
      if (song) {
        this.set({
          started: new Date(
            new Date().valueOf() - song.get('elapsed')
          )
        });
        this.startProgress();
      } else {
        this.unset('started');
        this.stopProgress();
      }
    },

    startProgress: function() {
      this.stopProgress();
      this._interval = setInterval(
        _.bind(this.updateProgress, this), progressInterval);
    },
    
    stopProgress: function() {
      if (this._interval) {
        clearInterval(this._interval);
        delete this._interval;
      }
    },

    updateProgress: function() {
      var song = this.get('song');
      var started = this.get('started');
      if (!song || !started) {
        this.stopProgress();
        return;
      }

      var now = new Date();
      var seconds = (now - started) / 1000 + 1;
      if (seconds > song.get('duration'))
        seconds = song.get('duration');

      this.set({ progress: seconds });
    }
  });

  models.User = Backbone.Model.extend({
    defaults: {
      admin: false,
      dj: false,
      firstDJ: false
    },

    initialize: function() {
      this.on('change:djOrder', function() {
        this.refreshIsFirstDJ();
      }, this);

      this.refreshIsFirstDJ();
    },

    refreshIsFirstDJ: function() {
      this.set({ firstDJ: this.get('djOrder') === 1 });
    }
  });

  models.Users = Backbone.Collection.extend({
    model: models.User,

    initialize: function() {
      this.comparator = 'username';
      this.on('add', this.userAdded, this);
      this.on('remove', this.userRemoved, this);
    },

    userAdded: function(user) {
      user.collection = this;
      user.on('change:username', this.sort, this);
      user.on('change:djOrder', this.sort, this);
    },

    userRemoved: function(user) {
      user.off('change:username', this.sort);
      user.off('change:djOrder', this.sort);
      if (user.collection === this)
        user.collection = null;
    },

    getUser: function(username) {
      return this.findWhere({ username: username });
    },

    removeByUsername: function(username) {
      var user = this.getUser(username);
      if (user) this.remove(user);
      return user;
    }
  });

  models.Song = Backbone.Model.extend();

  models.QueuedSong = Backbone.Model.extend({
    defaults: {
      order: 0
    },

    initialize: function() {
      this.on('change:order', this.orderChanged, this);
    },

    changePosition: function(position) {
      this.trigger('changeOrder', [ this, position ]);
    },

    orderChanged: function() {
      var oldIndex = this.collection.indexOf(this);
      this.collection.sort({ silent: true });
      var newIndex = this.collection.indexOf(this);

      if (newIndex !== oldIndex) {
        this.trigger('reindex', newIndex);
      }
    }
  });

  models.Queue = Backbone.Collection.extend({
    model: models.QueuedSong,

    initialize: function() {
      this.comparator = 'order';
      this.on('add', this.songAdded, this);
      this.on('remove', this.songRemoved, this);
    },

    songAdded: function(song) {
      song.on('change:playing', function() {
        this.trigger('change:playing');
      }, this);
      song.on('change:order', this.sort, this);
      song.on('changeOrder', function(data) {
        this.trigger('changeOrder', data);
      }, this);
    },

    songRemove: function(song) {
      song.off('change:order');
      song.off('changeOrder');
    },

    addOrUpdate: function(queued_song_data) {
      var existing_model = this.get(queued_song_data.id);
      if (existing_model) {
        existing_model.set(queued_song_data);
      } else {
        this.add(queued_song_data);
      }
    }
  });

  models.Room = Backbone.Model.extend({
    defaults: {
      anonymous_listeners: 0,
      connected: false,
      listeners: new models.Users(),
      dj: false,
      djs: new models.Users(),
      playback: new models.Playback()
    },

    initialize: function() {
      this.get('listeners').comparator = 'username';
      this.get('djs').comparator = 'djOrder';
      this.set({ username: this.get('connection').get('username') });
      this.on('change:connected', function() {
        if (this.get('connected'))
          this.unset('kick_message');
      }, this);
    },

    reset: function() {
      this.set(this.defaults);
      this.resetUsers();
      this.get('playback').reset();
    },

    resetUsers: function() {
      this.get('listeners').reset();
      this.get('djs').reset();
    },

    setUsers: function(users) {
      this.resetUsers();
      users.forEach(_.bind(this.addUser, this));
    },

    addUser: function(user) {
      var djs = this.get('djs');
      var listeners = this.get('listeners');

      if (!(user instanceof models.User))
        user = new models.User(user);

      user.on('change:dj', this.userDjChanged, this);

      if (user.get('dj'))
        djs.add(user);
      else
        listeners.add(user);
    },

    removeUser: function(username) {
      var dj = this.get('djs').removeByUsername(username);
      var listener = this.get('listeners').removeByUsername(username);

      var user = dj || listener;
      if (user)
        user.off('change:dj');
    },

    userDjChanged: function(user) {
      var djs = this.get('djs');
      var listeners = this.get('listeners');

      var dj = user.get('dj');
      if (dj) {
        listeners.remove(user);
        djs.add(user);
      } else {
        djs.remove(user);
        listeners.add(user);
      }

      if (user.get('username') === this.get('username'))
        this.set({ dj: dj });
    },

    getUser: function(username) {
      var djs = this.get('djs');
      var listeners = this.get('listeners');
      return djs.getUser(username) || listeners.getUser(username);
    },

    beginDJ: function() {
      this.get('connection').beginDJ();
    },

    endDJ: function() {
      this.get('connection').endDJ();
    }
  });
});

