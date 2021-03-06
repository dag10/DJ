/*jshint es5: true */

$(function() {
  var models = window.models = {};

  var progressInterval = 350;
  var search_throttle_ms = 200;
  var previewFadeDuration = 1200;

  // Model managing cookies.
  models.Cookies = Backbone.Model.extend({
    defaults: {
      muted: false
    },

    initialize: function() {
      Object.keys(this.attributes).forEach(_.bind(function(key) {
        var value = $.cookie(key);
        if (typeof value !== 'undefined') {
          if (value.toLowerCase() === 'true') {
            value = true;
          } else if (value.toLowerCase() === 'false') {
            value = false;
          } else if (typeof this.defaults[key] === 'number') {
            value = Number.parseFloat(value);
          }

          this.set(key, value);
        } else {
          $.cookie(key, this.get(key));
        }
      }, this));

      this.on('change', this.onChange, this);
    },

    onChange: function() {
      Object.keys(this.changedAttributes()).forEach(_.bind(function(key) {
        $.cookie(key, this.get(key));
      }, this));
    }
  });

  // Model to manage song previews, similar to Playback.
  models.PreviewController = Backbone.Model.extend({
    defaults: {
      preview: null,
      audio: null,
      timeout: null,
      fade: true,
    },

    initialize: function() {
      var audio = new Audio();
      audio.autoplay = true;
      audio.volume = 0;
      $(audio).on('playing', _.bind(this.setTimeout, this));
      this.set({ audio: audio });
      this.on('change:preview', this.previewChanged, this);
    },

    isPlaying: function() {
      return this.has('preview');
    },

    preview: function(cid, url, duration) {
      this.set({ preview: { cid: cid, url: url, duration: duration }});
    },

    endPreview: function() {
      this.unset('preview');
    },

    clearTimeout: function() {
      var timeout = this.get('timeout');
      if (timeout) {
        clearTimeout(timeout);
      }
    },

    setTimeout: function() {
      this.clearTimeout();
      var preview = this.get('preview');
      if (!preview) return;
      var timeout = setTimeout(_.bind(function() {
        this.endPreview();
      }, this), (preview.duration * 1000) + 500);
      this.set({ timeout: timeout });
    },

    previewChanged: function() {
      var fadeTime = this.get('fade') ? previewFadeDuration : 0;
      var oldPreview = this.previous('preview');
      var preview = this.get('preview');
      var audio = this.get('audio');

      if (oldPreview && preview) {
        this.clearTimeout();

        $(audio).stop().animate({ volume: 0 }, {
          easing: 'easeOutQuad',
          duration: fadeTime * 0.5,
          complete: _.bind(function() {
            audio.src = preview.url;
            $(audio).stop().prop('volume', 0).animate({ volume: 1 }, {
              duration: fadeTime * 0.5,
              easing: 'easeInQuad',
            });
          }, this),
        });
        this.trigger('preview:change');

      } else if (oldPreview) {
        this.clearTimeout();

        $(audio).stop().animate({ volume: 0 }, {
          duration: fadeTime,
          easing: 'easeOutQuad',
          complete: function() {
            audio.src = '';
          },
        });
        this.trigger('preview:end');

      } else if (preview) {
        audio.src = preview.url;
        $(audio).stop().prop('volume', 0).animate({ volume: 1 }, {
          duration: fadeTime,
          easing: 'easeInQuad',
        });
        this.trigger('preview:start');
      }
    },
  });

  // Base model for a song that is previewable.
  models.Previewable = Backbone.Model.extend({
    defaults: {
      connection: null,
      song_url: '',
      previewing: false,
    },

    initialize: function() {
      this.on('change:connection', this.connectionChanged, this);
      this.connectionChanged();
    },

    connectionChanged: function() {
      var conn = this.get('connection');
      var oldConn = this.previous('connection');

      if (conn) {
        conn.on('change:connected', this.connectionStatusChanged, this);
      }

      if (oldConn) {
        oldConn.off('change:connected', this.connectionStatusChanged, this);
      }
    },

    connectionStatusChanged: function() {
      var conn = this.get('connection');
      if (!conn || !conn.get('connected')) {
        this.endPreview(false);
      }
    },

    previewController: function() {
      return this.get('connection').get('previewController');
    },

    // When the user wants to start the preview.
    preview: function() {
      if (this.get('previewing')) return;

      var controller = this.previewController();

      controller.preview(this.cid, this.get('song_url'), this.get('duration'));
      controller.once('preview:end preview:change', function() {
        this.set({ previewing: false });
      }, this);
      

      this.set({ previewing: true });
    },

    // When the user wants to stop the preview.
    endPreview: function(fade) {
      if (!this.get('previewing')) return;
      var controller = this.previewController();

      if (typeof fade !== 'undefined' && !fade) {
        controller.set({ fade: false });
        controller.once('preview:end', function() {
          controller.set({ fade: true });
        });
      }

      controller.endPreview();
    },
  });

  // Model representing a song's information.
  models.Song = Backbone.Model.extend({
    defaults: {
      title: 'Unknown'
    }
  });

  // Model of the current song being played back.
  models.Playback = Backbone.Model.extend({
    defaults: {
      connection: null,
      selfIsDJ: false,
      skipVoted: false,
      progress: 0,
      liked: false,
      likes: 0,
      skipVotes: 0,
      skipVotesNeeded: 0,
      muted: false
    },

    initialize: function() {
      this.set({ muted: cookies.get('muted') });

      this.on('change:song', this.songChanged, this);
      this.on('change:muted', this.mutedChanged, this);
      
      var preview = this.get('connection').get('previewController');
      preview.on('preview:start', this.fadeDown, this);
      preview.on('preview:end', this.fadeUp, this);
    },

    reset: function() {
      this.unset('song');
    },

    fadeDown: function() {
      if (this.has('audio')) {
        $(this.get('audio')).stop().animate({ volume: 0 }, {
          duration: previewFadeDuration,
          easing: 'easeOutQuad',
        });
      }
    },

    fadeUp: function() {
      if (this.has('audio')) {
        $(this.get('audio')).stop().animate({ volume: 1 }, {
          duration: previewFadeDuration,
          easing: 'easeInQuad',
        });
      }
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

      this.set({
        selfIsDJ: isDJ,
        liked: false,
        likes: 0,
        skipVoted: false,
        skipVotes: 0,
        skipVotesNeeded: 0,
      });
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

    createAudio: function() {
      if (this.has('audio')) return;

      var audio = new Audio();
      audio.autoplay = true;
      audio.muted = this.get('muted');
      if (this.get('connection').get('previewController').isPlaying()) {
        audio.volume = 0;
      } else {
        audio.volume = 1;
      }
      this.set({ audio: audio });
    },

    destroyAudio: function() {
      if (!this.has('audio')) return;

      this.get('audio').src = '';
      this.unset('audio');
    },

    startAudio: function() {
      this.stopAudio();
      this.updateProgress();

      if (!this.has('song'))
        return;

      // If there is no audio object and we're not muted, create one.
      if (!this.has('audio') && !this.get('muted')) {
        this.createAudio();
      }

      if (this.has('audio')) {
        var audio = this.get('audio');
        audio.src = '';
        audio.src = '/stream/' + this.get('room').get('shortname') +
          '/current';
      }
    },

    stopAudio: function() {
      if (this.has('audio')) {
        var audio = this.get('audio');
        audio.src = '';

        // Destroy audio if we're stopping audio and it's currently muted.
        if (this.get('muted')) {
          this.destroyAudio();
        }
      }
    },

    mutedChanged: function() {
      var muted = this.get('muted');

      if (this.has('audio')) {
        this.get('audio').muted = muted;
      } else if (!muted) {
        // There's no audio object but we're being unmuted, so let's make one.
        this.startAudio();
      }

      cookies.set({ muted: muted });
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

    canSkipVote: function() {
      return (!!window.user && !this.get('skipVoted') && !this.get('liked') &&
              !this.get('selfIsDJ'));
    },

    canLike: function() {
      return (!!window.user && !this.get('skipVoted') && !this.get('liked') &&
              !this.get('selfIsDJ'));
    },

    mute: function() {
      this.set({ muted: true });
    },

    unmute: function() {
      this.set({ muted: false });
    },

    skip: function() {
      this.get('room').get('connection').sendSkip();
    },

    skipVote: function() {
      if (!this.canSkipVote()) return;

      // Immediately assume # votes will increment
      this.set({
        skipVotes: this.get('skipVotes') + 1,
        skipVoted: true,
      });

      this.get('room').get('connection').sendSkipVote();
    },

    like: function() {
      if (!this.canLike()) return;

      // Immediately assume # likes will increment
      this.set({
        likes: this.get('likes') + 1,
        liked: true,
      });

      this.get('room').get('connection').sendLike();
    }
  });

  // Model representing a user as it appears in the DJ and Listeners lists.
  models.User = Backbone.Model.extend({
    defaults: {
      admin: false,
      dj: false,
      skipVoted: false,
      liked: false,
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

  // Model representing a song being uploaded/added.
  models.SongAdd = Backbone.Model.extend({
    defaults: {
      name: '',
      size: 0,
      progress: 100
    },

    initialize: function() {
      this.on('remove', this.removed, this);
      this.idChanged();
    },

    idChanged: function() {
      if (!this.id) {
        this.once('change:id', this.idChanged, this);
        return;
      }

      this.get('connection').on(
        'song:add:added:' + this.id, this.onAdded, this);
      this.get('connection').on(
        'song:add:failed:' + this.id, this.onFailed, this);
      this.get('connection').on(
        'song:add:status:' + this.id, this.statusChanged, this);

      var adds = this.get('connection').get('song_adds');
      if (adds[this.id]) {
        this.set(adds[this.id]);
      }
    },

    failed: function(error) {
      this.set({
        status: 'failed',
        error: error
      });
    },

    onAdded: function(data) {
      this.set({
        status: 'added'
      });
    },

    onFailed: function(data) {
      this.failed(data.error);
    },

    statusChanged: function(data) {
      this.set({
        status: data.status
      });
    },

    removed: function() {
      if (this.id) {
        this.get('connection').off('song:add:status:' + this.id);
        this.get('connection').off('song:add:added:' + this.id);
        this.get('connection').off('song:add:failed:' + this.id);
      }
    }
  });

  // Model representing a search result being added to the queue.
  models.SearchAdd = models.SongAdd.extend({
    defaults: {
      progress: 0,
      status: 'adding'
    },

    initialize: function() {
      this.constructor.__super__.initialize.apply(this, arguments);
      var result = this.get('result');

      this.set({
        name: result.get('title'),
        source: result.get('source'),
        source_id: result.id
      });

      this.get('connection').enqueueFromSource(
        this.get('source'), this.get('source_id'),
        _.bind(function(data) {
          if (data.error) {
            this.failed(data.error);
          } else {
            this.set({ id: data.job_id });
          }
        }, this));
    }
  });

  // Model representing a song being added by uploading.
  models.SongUpload = models.SongAdd.extend({
    defaults: {
      progress: 0,
      status: 'uploading'
    },

    initialize: function(attrs, upload) {
      this.constructor.__super__.initialize.apply(this, arguments);

      var file = upload.files[0];

      this.set({
        name: file.name,
        size: file.size
      });

      if (file.size > window.config.max_file_size) {
        var max_mb = Math.floor(window.config.max_file_size / 1024 / 1024);
        this.failed('File cannot be larger than ' + max_mb + 'MB');
        return;
      }

      upload.jqXHR = upload.submit();
      upload.jqXHR.then(
        _.bind(this.onSuccess, this),
        _.bind(this.onFail, this));

      var intervalId = setInterval(
        _.bind(this.updateProgress, this),
        upload.progressInterval);

      this.set({
        progressIntervalId: intervalId,
        upload: upload
      });

      this.on('remove', this.abort, this);
    },

    abort: function() {
      this.get('upload').jqXHR.abort();
    },

    onSuccess: function(data, textStatus, jqXHR) {
      this.stopUpdatingProgress();

      if (typeof data.job_id === 'number') {
        this.set({
          progress: 100,
          status: 'processing',
          id: data.job_id
        });
      } else {
        this.set({
          progress: 100,
          status: 'failed',
          error: 'Unknown response from server'
        });
      }
    },

    onFail: function(jqXHR, textStatus, errorThrown) {
      this.stopUpdatingProgress();

      var error;
      if (textStatus === 'abort') {
        error = 'Upload canceled.';
      } else if (jqXHR.responseJSON) {
        error = jqXHR.responseJSON.error;
      }

      this.set({
        status: 'failed',
        error: error
      });
    },

    updateProgress: function() {
      var upload = this.get('upload');
      var progress = upload.progress();
      var percent = progress.loaded / progress.total * 100;

      if (percent >= 100) {
        percent = 100;
        this.stopUpdatingProgress();
      }

      this.set({ progress: percent });
    },

    stopUpdatingProgress: function() {
      if (this.has('progressIntervalId')) {
        clearInterval(this.get('progressIntervalId'));
        this.unset('progressIntervalId');
      }
    }
  });

  // Collection for songs being added.
  models.SongAdds = Backbone.Collection.extend({
    model: models.SongAdd,

    initialize: function() {
      this.on('reset', this.handleReset, this);
      this.on('add', this.songAddAdded, this);
      this.on('remove', this.songAddRemoved, this);

      this.handleReset();
    },

    songAddAdded: function(song_add) {
      song_add.on('change:status', function() {
        if (song_add.get('status') === 'added') {
          setTimeout(_.bind(function() {
            this.remove(song_add);
          }, this), 3000);
        }
      }, this);
    },

    handleReset: function(models, options) {
      if (options && options.previousModels) {
        _.each(options.previousModels, function(model) {
          model.trigger('remove');
        });
      }
      this.each(this.songAddAdded, this);
    },

    songAddRemoved: function(song_add) {
      song_add.off('change:status');
    }
  });

  // Model managing the adding of songs.
  models.SongAdder = Backbone.Model.extend({
    initialize: function() {
      this.set({ adds: new models.SongAdds() });
      this.get('connection').on(
        'change:connected', this.connectedChanged, this);
    },

    connectedChanged: function() {
      if (!this.get('connection').get('connected')) {
        this.get('adds').reset();
      }
    },

    songUploadAdded: function(event, data) {
      this.get('adds').add(new models.SongUpload({
        connection: this.get('connection')
      }, data));
    },

    enqueueSearchResult: function(result) {
      this.get('adds').add(new models.SearchAdd({
        result: result,
        connection: this.get('connection')
      }));
    }
  });

  // Model representing a song in the song queue.
  models.QueuedSong = models.Previewable.extend({
    defaults: {
      order: 0,
      next: false
    },

    initialize: function() {
      this.constructor.__super__.initialize.apply(this, arguments);

      this.on('change:order', this.orderChanged, this);
      this.on('change:order', this.checkIfNext, this);
      this.on('change:song_path', this.updateSongUrl, this);
      this.on('remove', this.endPreview, this);
      this.collection.on('change:playing', this.checkIfNext, this);
      this.set({ connection: this.collection.connection });
      this.checkIfNext();
      this.updateSongUrl();
    },

    updateSongUrl: function() {
      this.set({ song_url: this.get('song_path') });
    },

    changePosition: function(position) {
      this.trigger('changeOrder', [ this, position ]);
    },

    escalate: function() {
      this.trigger('escalate', this);
    },

    removeFromQueue: function() {
      this.trigger('removeFromQueue', this);
    },

    checkIfNext: function() {
      var collectionPlaying = this.collection.hasPlayingSong();
      var playing = this.get('playing');
      var next = ((collectionPlaying && this.get('order') === 2) ||
                 (!collectionPlaying && this.get('order') === 1));
      this.set({ next: next });
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

    hasPlayingSong: function() {
      var songs = this.where({ playing: true });
      return songs && songs.length > 0;
    },

    songAdded: function(song) {
      song.on('change:order', this.sort, this);
    },

    songRemove: function(song) {
      song.off();
    },

    addOrUpdate: function(queued_song_data) {
      var existing_model = this.get(queued_song_data.id);
      if (existing_model) {
        existing_model.set(queued_song_data);
      } else {
        queued_song_data.reasonAdded = 'enqueue';
        this.add(queued_song_data);
      }
    }
  });

  // Data for a song in a search result.
  models.SearchResult = Backbone.Model.extend({
    addToQueue: function() {
      this.trigger('enqueue', this);
    }
  });

  // Collection of pure SearchResult entities.
  models.SearchResultList = Backbone.Collection.extend({
    model: models.SearchResult
  });

  // Model representing a section of the search results.
  models.SearchResultSection = Backbone.Model.extend({
    defaults: {
      loading: false,
      source: null,
      title: null
    },

    initialize: function() {
      this.id = this.get('source');
      this.on('change:source', function(source) { this.id = source; }, this);
      this.set({
        results: new models.SearchResultList(),
        resultsCache: {}
      });
      this.get('results').on('enqueue', this.enqueue, this);

      this.collection.resultsModel.on('change:query', this.queryChanged, this);
    },

    queryChanged: function() {
      var query = this.collection.resultsModel.get('query');

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

    requestResults: function(query) {
      this.set({ loading: true });
      this.collection.resultsModel.get('connection').searchSource(
        this.get('source'), query, _.bind(this.resultsReceived, this));
    },

    resultsReceived: function(resultsData) {
      if (!resultsData) {
        resultsData = {
          error: 'No results data received.',
          query: '(unknown)'
        };
      }

      var query = resultsData.query;

      if (resultsData.error) {
        console.warn('Error with ' + this.get('source') + ' search results ' +
                     'for "' + query + '":', resultsData.error);
      } else if (query && typeof query === 'string') {
        this.get('resultsCache')[query] = resultsData;
        this.handleResults(query, resultsData);
      }
    },

    handleResults: function(query, resultsData) {
      var resultsModel = this.collection.resultsModel;

      if (resultsModel.get('query').trim().length === 0 ||
          query === resultsModel.get('query')) {
        this.set({ loading: false });
      }

      if (resultsModel.get('query').trim().length === 0 ||
          resultsModel.get('locked')) return;

      this.setResults(resultsData.results);
    },

    enqueue: function(result) {
      result.set({ source: this.get('source') });
      this.trigger('enqueue', result);
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
    model: models.SearchResultSection,

    initialize: function(items, opts) {
      this.resultsModel = opts.resultsModel;
    }
  });

  // Model representing the entire state of the search results.
  models.SearchResults = Backbone.Model.extend({
    defaults: {
      query: '',
      locked: false
    },

    initialize: function() {
      this.set({ resultsCache: {} });

      var sections = this.get('sections') || [];
      this.set({
        sections: new models.SearchResultSections(sections, {
          resultsModel: this
        })
      });

      this.get('sections').on('enqueue', this.enqueue, this);
    },

    enqueue: function(result) {
      this.get('adder').enqueueSearchResult(result);
    },

    clearResults: function() {
      this.set({
        locked: false
      });
      this.get('sections').forEach(function(section) {
        section.clearResults();
      });
    }
  });

  // Model representing an activity in a room.
  models.Activity = Backbone.Model.extend({
    defaults: {
      type: null
    }
  });

  // Model representing specifically a song-playing activity.
  models.SongActivity = models.Previewable.extend({
    defaults: {
      likes: 0,
      skipVotes: 0,
      skipVoted: false,
    },

    initialize: function() {
      this.constructor.__super__.initialize.apply(this, arguments);

      if (this.collection) {
        this.collection.on('reset', function() {
          this.endPreview(false);
        }, this);
      }
    },

    enqueue: function(callback) {
      this.set({ enqueueing: true });
      this.collection.room.get('connection').enqueuedActivity(this.id);
      this.collection.room.get('connection').enqueueFromSource(
        'upload', this.get('song_id'), _.bind(function() {
        this.set({
          enqueueing: false,
          enqueued: true
        });
      }, this));
    },
  });

  // Collection holding activities.
  models.Activities = Backbone.Collection.extend({
    model: models.Activity,

    addActivity: function(activityData) {
      var model = this.model;

      if (activityData.type === 'song') {
        model = models.SongActivity;
      }

      activityData.connection = this.room.get('connection');

      this.add(new model(activityData, {
        collection: this,
      }), {
        merge: true,
      });
    },

    resetWithActivities: function(activities) {
      activities = activities || [];
      this.reset();
      _.each(activities, _.bind(this.addActivity, this));
    }
  });

  // Model representing the state of the current room.
  models.Room = Backbone.Model.extend({
    defaults: {
      anonymous_listeners: 0,
      connected: false,
      dj: false
    },

    initialize: function() {
      this.set({
        activities: new models.Activities(),
        listeners: new models.Users(),
        djs: new models.Users(),
        playback: new models.Playback({
          connection: this.get('connection')
        })
      });
      this.get('activities').room = this;
      this.get('playback').set({ room: this });
      this.get('listeners').comparator = 'username';
      this.get('djs').comparator = 'djOrder';
      this.set({ username: this.get('connection').get('username') });
      this.on('change:connected', function() {
        if (this.get('connected')) {
          this.unset('kick_message');
        }
      }, this);
      window.onbeforeunload = _.bind(this.unloadConfirmation, this);
    },

    reset: function() {
      this.set(this.defaults);
      this.resetUsers();
      this.get('playback').reset();
      this.get('activities').reset();
    },

    resetUsers: function() {
      this.get('listeners').reset();
      this.get('djs').reset();
    },

    setUsers: function(users) {
      this.resetUsers();
      users.forEach(_.bind(this.addUser, this));
    },

    addActivity: function(activity) {
      this.get('activities').addActivity(activity);
    },

    setActivities: function(activities) {
      this.get('activities').resetWithActivities(activities);
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
    },

    unloadConfirmation: function() {
      if (this.get('dj')) {
        if (this.get('playback').get('selfIsDJ')) {
          return 'You\'re currently playing music. If you navigate away, ' +
                 'your music will stop.';
        } else {
          return 'You\'re currently a DJ. If you navigate away, you will ' +
                 'lose your spot in the queue.';
        }
      }

      return null;
    }
  });
});

