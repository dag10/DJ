$(function() {
  var models = window.models = {};

  var progressInterval = 10;
  var search_throttle_ms = 200;

  // Model representing a song's information.
  models.Song = Backbone.Model.extend({
    defaults: {
      title: 'Unknown'
    }
  });

  // Model of the current song being played back.
  models.Playback = Backbone.Model.extend({
    defaults: {
      selfIsDJ: false,
      progress: 0,
      muted: false
    },

    initialize: function() {
      var audio = new Audio();
      audio.autoplay = true;
      this.set({ audio: audio });

      this.on('change:song', this.songChanged, this);
      this.on('change:muted', this.mutedChanged, this);
    },

    reset: function() {
      this.unset('song');
    },

    songChanged: function() {
      var isDJ = false;
      var song = this.get('song');
      if (song) {
        this.set({
          started: new Date(
            new Date().valueOf() - song.get('elapsed')
          )
        });
        if (window.user && window.user.id &&
            song.get('dj') &&
            song.get('dj').id === window.user.id) {
          isDJ = true;
        }
        this.startPlayback();
      } else {
        this.unset('started');
        this.stopPlayback();
      }

      this.set({ selfIsDJ: isDJ });
    },

    startPlayback: function() {
      this.stopPlayback();
      this._interval = setInterval(
        _.bind(this.updateProgress, this), progressInterval);
      this.startAudio();
    },
    
    stopPlayback: function() {
      if (this._interval) {
        clearInterval(this._interval);
        delete this._interval;
      }
      this.stopAudio();
    },

    startAudio: function() {
      this.stopAudio();
      this.updateProgress();

      if (!this.has('song'))
        return;

      var audio = this.get('audio');
      audio.src = '/stream/' + this.get('room').get('shortname') +
        '/current?' + Math.floor(Math.random() * 100);
      console.log('Setting audio src:', audio.src);
    },

    stopAudio: function() {
      var audio = this.get('audio');
      audio.src = '';
    },

    mutedChanged: function() {
      this.get('audio').muted = this.get('muted');
    },

    updateProgress: function() {
      var song = this.get('song');
      var started = this.get('started');
      if (!song || !started) {
        this.stopPlayback();
        return;
      }

      var now = new Date();
      var seconds = (now - started) / 1000;
      if (seconds > song.get('duration'))
        seconds = song.get('duration');

      this.set({ progress: seconds });
    },

    mute: function() {
      this.set({ muted: true });
    },

    unmute: function() {
      this.set({ muted: false });
    },

    skip: function() {
      this.get('room').get('connection').sendSkip();
    }
  });

  // Model representing a user as it appears in the DJ and Listeners lists.
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

  // Collection containing a pure list of users.
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

  // Model representing a song in the song queue.
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

    removeFromQueue: function() {
      this.trigger('removeFromQueue', this);
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

  // Collection of QueuedSongs. Represents the entirety of one's song queue.
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
      song.off();
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

  // Data for a song in a search result.
  models.SearchResult = Backbone.Model.extend();

  // Collection of pure SearchResult entities.
  models.SearchResultList = Backbone.Collection.extend({
    model: models.SearchResult
  });

  // Model representing a section of the search results.
  models.SearchResultSection = Backbone.Model.extend({
    defaults: {
      source: null,
      title: null
    },

    initialize: function() {
      this.id = this.get('source');
      this.on('change:source', function(source) { this.id = source; }, this);
      this.set({
        results: new models.SearchResultList()
      });
    },

    setResults: function(results) {
      this.get('results').reset(results);
    },

    clearResults: function() {
      this.get('results').reset();
    }
  });

  // Collection of SearchResultSections.
  models.SearchResultSections = Backbone.Collection.extend({
    model: models.SearchResultSection
  });

  // Model representing the entire state of the search results.
  models.SearchResults = Backbone.Model.extend({
    defaults: {
      query: '',
      loading: false,
      locked: false
    },

    initialize: function() {
      this.set({ resultsCache: {} });

      var sections = this.get('sections') || [];
      this.set({
        sections: new models.SearchResultSections(this.get('sections'))
      });

      this.on('change:query', this.queryChanged, this);
    },

    queryChanged: function() {
      var query = this.get('query');

      if (query && query.trim().length > 0) {
        var cache = this.get('resultsCache');

        if (query in cache) {
          this.handleResults(query, cache[query]);
        } else {
          this.requestResults(query);
        }
      } else {
        this.clearResults();
      }
    },

    requestResults: _.throttle(function(query) {
      this.set({ loading: true });
      this.get('connection').search(
        query, _.bind(this.resultsReceived, this));
    }, search_throttle_ms),

    resultsReceived: function(resultsData) {
      var query = resultsData.query;

      if (resultsData.error) {
        console.error('Error with search results:', resultsData.error);
      } else if (query && typeof query === 'string') {
        this.get('resultsCache')[query] = resultsData;
        this.handleResults(query, resultsData);
      }
    },

    handleResults: function(query, resultsData) {
      if (query === this.get('query')) {
        this.set({ loading: false });
      }

      if (this.get('locked')) return;

      var sections = this.get('sections');
      resultsData.sections.forEach(function(sectionData) {
        var section = sections.get(sectionData.source);
        if (section) {
          section.setResults(sectionData.results);
        } else {
          console.warn('Unknown section:', sectionData.source);
        }
      });
    },

    clearResults: function() {
      this.set({
        locked: false,
        loading: false
      });
      this.get('sections').forEach(function(section) {
        section.clearResults();
      });
    }
  });

  // Model representing the state of the current room.
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
      this.get('playback').set({ room: this });
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

