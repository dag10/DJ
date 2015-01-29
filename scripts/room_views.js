/*jshint es5: true */

$(function() {
  function secondsToTimestamp(seconds) {
    if (seconds === 0) return '0:00';
    seconds = Math.floor(seconds);

    var remainingSeconds = seconds % 60;
    var retStr = '';

    retStr += Math.floor(seconds/60);
    retStr += ':';
    if (remainingSeconds < 10)
      retStr += '0';
    retStr += remainingSeconds;

    return retStr;
  }

  var views = window.views = {};

  views.Body = Backbone.View.extend({
    el: 'body',

    events: {
      'mousedown': 'event',
      'mouseup': 'event'
    },

    event: function(event) {
      this.trigger(event.type);
    }
  });

  views.Room = Backbone.View.extend({
    events: {
      'click #btn-begin-dj': 'beginDJ',
      'click #btn-end-dj': 'endDJ'
    },

    initialize: function() {
      this.model.on(
          'change:anonymous_listeners', this.renderNumAnonymous, this);
      this.model.on(
          'change:name', this.updateRoomName, this);
      this.model.on(
          'change:connected change:kick_message', this.renderRoomName, this);
      this.model.on(
          'change:connected change:kick_message', this.renderAlert, this);
      this.model.on(
          'change:dj change:connected change:kick_message',
          this.renderDJButton, this);

      this.$('#btn-begin-dj').tooltip({
        title: 'Play Music',
        trigger: 'hover',
        placement: 'left',
        delay: {
          show: 400,
          hide: 0
        }
      });

      this.$('#btn-end-dj').tooltip({
        title: 'Stop Playing Music',
        trigger: 'hover',
        placement: 'left',
        delay: {
          show: 400,
          hide: 0
        }
      });

      this.render();
    },

    beginDJ: function(e) {
      this.model.beginDJ();
      e.preventDefault();
    },

    endDJ: function(e) {
      this.model.endDJ();
      e.preventDefault();
    },

    render: function() {
      this.renderNumAnonymous();
      this.renderRoomName();
      this.renderAlert();
      this.renderDJButton();
    },

    renderDJButton: function() {
      var $placeholder = this.$('#btn-dj-placeholder');
      var $begin = this.$('#btn-begin-dj');
      var $end = this.$('#btn-end-dj');
      
      if (!this.model.get('connected')) {
        $placeholder.show();
        $begin.hide();
        $end.hide();
      } else if (this.model.get('dj')) {
        $placeholder.hide();
        $begin.hide();
        $end.show();
      } else {
        $placeholder.hide();
        $end.hide();
        $begin.show();
      }
    },

    renderNumAnonymous: function() {
      var num = this.model.get('anonymous_listeners');
      var s = num == 1 ? '' : 's';
      $('#num-anonymous').html(
        '<h1>' + num + ' Anonymous Listener' + s + '</h1>');
    },

    renderRoomName: function() {
      var name = this.model.escape('name') || 'Room';

      $('.room-name').html(name);

      if (this.model.get('connected'))
        document.title = name;
      else if (this.model.has('kick_message'))
        document.title = 'Kicked';
      else
        document.title = 'Disconnected';
    },

    renderAlert: function() {
      if (this.model.get('connected'))
        $('.alert-text').text('');
      else if (this.model.has('kick_message'))
        $('.alert-text').text(
          'You were kicked: ' + this.model.get('kick_message'));
      else
        $('.alert-text').text('Disconnected.');
    }
  });

  views.User = Backbone.View.extend({
    template: Handlebars.compile($('#user-template').html()), 

    initialize: function() {
      this.model.on('change:skipVoted', this.updateVotes, this);
    },

    updateVotes: function(animated) {
      if (animated === undefined) animated = true;
      var duration = animated ? 150 : 0;

      if (this.model.get('skipVoted')) {
        this.$('.skipvote').animate({
          right: 0
        }, duration);
      } else {
        this.$('.skipvote').animate({
          right: -20
        }, duration);
      }
    },

    render: function() {
      this.$el.html(this.template(this.model.attributes));
      this.updateVotes(false);

      return this;
    }
  });

  views.Users = Backbone.View.extend({
    initialize: function() {
      this.userViews = [];

      this.collection.each(this.add);
      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('reset', this.reset, this);
      this.collection.on('sort', this.render, this);

      this.render();
    },

    reset: function() {
      _.each(this.userViews, function(userView) {
        userView.remove();
      });

      this.userViews = [];
      this.render();
    },

    add: function(user) {
      var userView = new views.User({
        tagName: 'li',
        className: 'user',
        model: user
      });

      this.userViews.push(userView);
      this.render();
    },

    remove: function(user) {
      this.userViews = _(this.userViews).without(this.getViewForUser(user));
      this.render();
    },

    getViewForUser: function(user) {
      return _(this.userViews).select(function(userView) {
        return userView.model === user;
      })[0];
    },

    render: function() {
      var $ul = this.$('ul');
      var $placeholder = this.$('.section-empty');

      var scrollTop = this.el.scrollTop;

      if (this.collection.length === 0)
        $placeholder.show();
      else
        $placeholder.hide();

      $ul.empty();
      this.collection.forEach(function(user) {
        $ul.append(this.getViewForUser(user).render().el);
      }, this);

      this.el.scrollTop = scrollTop;
    }
  });

  views.Activity = Backbone.View.extend({
    tagName: 'li',

    initialize: function() {
      this.model.set({ prettyDate: this.prettyDate(this.model.get('date')) });
    },

    prettyDate: function(date) {
      return moment(date).format('MMM Do, h:mm:ss a');
    },

    updateRelativeDate: function() {
      var date = this.model.get('date');
      var now = Date.now();
      if (date > now) date = now;
      this.$('.fuzzytime').text(moment(date).fromNow());
    },

    context: function() {
      return {};
    },

    render: function() {
      if (this.template) {
        var context = {};
        var attrs = this.model.attributes;
        Object.keys(attrs).forEach(function(key) {
          context[key] = attrs[key];
        });
        var customContext = this.context();
        Object.keys(customContext).forEach(function(key) {
          context[key] = customContext[key];
        });
        this.$el.html(this.template(context));
        this.$el.addClass('activity-' + this.model.get('type'));
      } else {
        this.$el.text('Unknown activity type: ' + this.model.get('type'));
      }

      this.updateRelativeDate();
      return this;
    }
  });

  views.JoinLeaveActivity = views.Activity.extend({
    template: Handlebars.compile($('#activity-join-leave-template').html()),

    initialize: function() {
      views.Activity.prototype.initialize.apply(this);

      this.model.set({
        verb: this.model.get('type') === 'join' ? 'joined' : 'left'
      });
    }
  });

  views.SongActivity = views.Activity.extend({
    template: Handlebars.compile($('#activity-song-template').html()),

    events: {
      'click .action-enqueue': 'enqueue'
    },

    initialize: function() {
      views.Activity.prototype.initialize.apply(this);

      this.model.set({ enqueued: false });
      this.model.on('change', this.render, this);
    },

    enqueue: function() {
      if (!this.model.get('enqueued') && !this.model.get('enqueueing')) {
        this.model.enqueue();
      }

      return false;
    }
  });

  views.Activities = Backbone.View.extend({
    initialize: function() {
      this.views = [];

      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('reset', this.reset, this);

      this.collection.each(this.add, this);
      this.render();

      this.interval = setInterval(_.bind(function() {
        this.views.forEach(function(view) {
          view.updateRelativeDate();
        });
      }, this), 5000);

      this.on('remove', _.bind(function() {
        clearInterval(this.interval);
      }, this));
    },

    reset: function() {
      _.each(this.views, function(view) {
        view.remove();
      });

      this.views = [];
      this.collection.each(this.add, this);
      this.render();
    },

    add: function(activity) {
      var viewtype = views.Activity;
      var type = activity.get('type');

      if (type === 'join' || type === 'leave') {
        viewtype = views.JoinLeaveActivity;
      } else if (type === 'song') {
        viewtype = views.SongActivity;
      }

      var view = new viewtype({
        tagName: 'li',
        model: activity
      });

      this.views.push(view);
      this.$el.prepend(view.render().el);
    },

    remove: function(activity) {
      this.views = _(this.views).without(this.getViewForActivity(activity));
      this.render();
    },

    getViewForActivity: function(activity) {
      return _(this.views).select(function(view) {
        return view.model === activity;
      })[0];
    }
  });

  views.SongAdd = Backbone.View.extend({
    tagName: 'li',

    template: Handlebars.compile($('#song-add-template').html()),

    initialize: function() {
      this.model.on('change:status', this.render, this);
      this.model.on('change:error', this.render, this);
      this.model.on('change:progress', this.renderProgress, this);
      this.render();
    },

    renderProgress: function() {
      this
        .$('.background-progress')
        .css({ width: this.model.get('progress') + '%'});
    },

    render: function() {
      var model = this.model.attributes;
      model.added = model.status === 'added';
      model.failed = model.status === 'failed';
      
      if (model.size) {
        model.mb = Math.round(model.size / 1024 / 1024 * 10) / 10;
      }

      if (model.failed) {
        this.$el.addClass('failed');
      } else {
        this.$el.removeClass('failed');
      }

      if (model.added) {
        this.$el.addClass('added');
      } else {
        this.$el.removeClass('added');
      }

      switch (model.status.toLowerCase()) {
        case 'metadata':
          model.status = 'extracting metadata';
          break;
        case 'artwork':
          model.status = 'extracting artwork';
          break;
        case 'waiting':
          model.status = 'waiting to transcode';
          break;
        case 'transcoding':
          model.status = 'transcoding audio';
          break;
      }

      this.$el.html(this.template(model));
      this.renderProgress();
      return this;
    }
  });

  views.SongAdds = Backbone.View.extend({
    initialize: function() {
      this.views = [];
      this.closeable = false;

      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('reset', this.reset, this);
      this.collection.on('change:status', this.updateCloseable, this);

      this.initializeHeader();
      this.reset();
    },

    reset: function(render) {
      this.views = [];
      this.collection.each(function(song_add) {
        this.add(song_add, false);
      }, this);

      if (render || render === undefined) {
        this.render();
      }
    },

    add: function(song_add, render) {
      var view = new views.SongAdd({
        tagName: 'li',
        model: song_add
      });

      this.views.push(view);

      if (render || render === undefined) {
        this.render();
      }
    },

    remove: function(song_add, render) {
      this.views = _(this.views).without(this.getViewForSongAdd(song_add));

      if (render || render === undefined) {
        this.render();
      }
    },

    updateCloseable: function() {
      var oldVal = this.closeable;
      this.closeable = true;

      this.collection.each(function(song_add) {
        if (['added', 'failed'].indexOf(song_add.get('status')) < 0) {
          this.closeable = false;
        }
      }, this);

      if (this.closeable !== oldVal) {
        this.renderHeader();
      }
    },

    getViewForSongAdd: function(song_add) {
      return _(this.views).select(function(view) {
        return view.model === song_add;
      })[0];
    },

    initializeHeader: function() {
      this.
      $('#btn-close-uploads')
      .click(_.bind(function(e) {
        e.preventDefault();
        this.collection.reset();
      }, this))
      .tooltip({
        title: 'Close',
        trigger: 'hover'
      });
    },

    renderHeader: function() {
      var $header = this.$('#uploads-header');
      var $btnClose = this.$('#btn-close-uploads');

      $header.toggle(this.collection.length > 0);
      $btnClose.toggle(this.closeable);

      if (!this.collection.closeable || this.collection.length === 0) {
        $btnClose.tooltip('hide');
      }
    },

    render: function() {
      var $ul = this.$('#previews');
      var $uploads = this.$('#uploads-container');

      var scrollTop = this.el.scrollTop;

      $ul.empty();
      this.collection.forEach(function(song_add) {
        $ul.prepend(this.getViewForSongAdd(song_add).render().el);
      }, this);

      $uploads.toggle(this.collection.length > 0);

      this.renderHeader();

      this.el.scrollTop = scrollTop;
    }
  });

  views.SongAdder = Backbone.View.extend({
    initialize: function(opts) {
      this.connection = opts.connection;

      this.songAdds = new views.SongAdds({
        el: this.el,
        collection: this.model.get('adds')
      });

      this.$songupload = this.$('#songupload');
      this.$songupload.fileupload({
        url: '/song/upload',
        replaceFileInput: false,
        dataType: 'json',
        limitConcurrentUploads: 10,
        dropZone: this.$el,
        add: _.bind(this.model.songUploadAdded, this.model)
      });

      this.$btnupload = this.$('#btn-upload');
      this.$btnupload.click(_.bind(function(event) {
        this.$songupload.click();
        return false;
      }, this));

      this.$el.on('dragover', _.bind(function() {
        this.$el.addClass('dragging');
      }, this));

      this.$el.on('dragleave', _.bind(function() {
        this.$el.removeClass('dragging');
      }, this));

      this.$el.on('drop', _.bind(function(e) {
        this.$el.removeClass('dragging');
        e.preventDefault();
      }, this));

      this.connection.on('change:connected', function() {
        if (this.connection.get('connected')) {
          this.$btnupload.removeAttr('disabled');
        } else {
          this.$btnupload.attr('disabled', 'disabled');
        }
      }, this);
    }
  });

  views.QueuedSong = Backbone.View.extend({
    tagName: 'li',
    className: 'queued-song',

    template: Handlebars.compile($('#queue-item-template').html()), 

    initialize: function() {
      this.model.on('reindex', this.reindex, this);
      this.model.on('change:playing', this.render, this);
      this.model.on('change:next', this.render, this);
      this.firstRender = true;
    },

    events: {
      'drop': 'drop',
      'click .btn-escalate': 'escalate',
      'click .btn-remove': 'remove'
    },

    drop: function(event, index) {
      if (typeof index === 'number') {
        this.$el.trigger('sorted', [this.model, index]);
      }
    },

    escalate: function() {
      if (this.model.get('next')) return false;

      var speed = 120;
      this.slideFromLeft(true, speed).then(_.bind(function() {
        this.model.once('change:order', function() {
          this.slideFromLeft(false, speed);
        }, this);
        this.model.escalate();
      }, this));
      return false;
    },

    remove: function() {
      this.slideFromRight(true).then(_.bind(function() {
        this.model.removeFromQueue();
      }, this));
      return false;
    },

    reindex: function(newIndex) {
      var currIndex = this.$el.index();
      var parent = this.$el.parent();
      if (currIndex === newIndex) return;
      this.$el.remove();

      if (newIndex > 0)
        this.$el.insertAfter(parent.children().eq(newIndex - 1));
      else
        this.$el.insertBefore(parent.children().first());

      this.render();
    },

    animate: function(from, to, speed) {
      speed = speed || 330;
      var deferred = $.Deferred();
      this.$el.css(from).animate(to, 330, $.swing, deferred.resolve);
      return deferred.promise();
    },

    slideFromLeft: function(reverse, speed) {
      reverse = reverse || false;

      var from = { left: -300 };
      var to = { left: 0 };

      if (reverse === true) {
        return this.animate(to, from, speed);
      } else {
        return this.animate(from, to, speed);
      }
    },

    slideFromRight: function(reverse, speed) {
      reverse = reverse || false;
      
      var from = { right: -300 };
      var to = { right: 0 };

      if (reverse === true) {
        return this.animate(to, from, speed);
      } else {
        return this.animate(from, to, speed);
      }
    },

    render: function() {
      if (this.firstRender) {
        this.firstRender = false;

        if (this.model.get('reasonAdded') === 'enqueue') {
          this.slideFromRight();
        }
      }

      var attributes = this.model.attributes;

      attributes.formattedDuration = secondsToTimestamp(attributes.duration);

      this.undelegateEvents();
      this.$el.html(this.template(attributes));
      this.delegateEvents();
      this.$el.disableSelection();

      if (this.model.get('playing')) {
        this.$el.addClass('playing');
      } else {
        this.$el.removeClass('playing');
      }

      if (this.model.get('next')) {
        this.$el.addClass('next');
        this.$('.btn-escalate').addClass('disabled');
      } else {
        this.$el.removeClass('next');
      }

      return this;
    }
  });

  views.Queue = Backbone.View.extend({
    events: {
      'sorted #queue-list': 'sorted'
    },

    initialize: function(opts) {
      this.ui_hidden = false;
      this.views = [];

      this.connection = opts.connection;
      this.connection.on('change:connected', this.updatePlaceholder, this);

      this.collection.each(_.bind(this.add, this));
      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('reset', this.reset, this);

      this.$('#queue-list').sortable({
        axis: 'y',
        items: 'li:not(.playing)',
        cancel: 'li.playing',
        stop: function(event, ui) {
          ui.item.trigger('drop', ui.item.index());
        }
      });

      this.render();
    },

    reset: function() {
      _.each(this.views, function(view) {
        view.remove();
      });

      this.views = [];
      this.render();
    },

    add: function(queuedSong) {
      this.views.push(new views.QueuedSong({
        model: queuedSong
      }));
      this.render();
    },

    remove: function(queuedSong) {
      this.views = _(this.views).without(
        this.getViewForQueuedSong(queuedSong));
      this.render();
    },

    getViewForQueuedSong: function(queuedSong) {
      return _(this.views).select(function(view) {
        return view.model === queuedSong;
      })[0];
    },

    hideUI: function() {
      this.ui_hidden = true;
      this.$('.queue-header').hide();
      this.$('#queue-list').hide();
      this.updatePlaceholder();
    },

    showUI: function() {
      this.ui_hidden = false;
      this.$('.queue-header').show();
      this.$('#queue-list').show();
      this.updatePlaceholder();
    },

    render: function() {
      var $ul = this.$('#queue-list');

      $ul.empty();
      this.collection.forEach(function(queuedSong) {
        $ul.append(this.getViewForQueuedSong(queuedSong).render().el);
      }, this);

      this.updatePlaceholder();
      return this;
    },

    updatePlaceholder: function() {
      var $placeholder = this.$('#queue-placeholder');

      if (!this.ui_hidden && this.connection.get('connected') &&
          this.collection.length === 0) {
        $placeholder.show();
      } else {
        $placeholder.hide();
      }
    },

    sorted: function(event, model, position) {
      model.changePosition(position + 1);
    }
  });

  views.SearchResult = Backbone.View.extend({
    template: Handlebars.compile($('#search-result-template').html()),
    tagName: 'li',
    className: 'song',

    events: {
      'click': 'addSong'
    },

    addSong: function() {
      this.model.addToQueue();
    },

    initialize: function() {
      this.render();
    },

    render: function() {
      this.$el.html(this.template(this.model.attributes));
      return this;
    }
  });

  views.SearchSection = Backbone.View.extend({
    model: models.SearchResultSection,
    template: Handlebars.compile($('#search-section-template').html()), 

    initialize: function() {
      this.model.get('results').on('reset', this.resultsReset, this);
      this.model.get('results').on(
        'reset add remove', this.updatePlaceholder, this);
      this.model.on('change:loading', this.updateLoading, this);
      this.render();
    },

    resultsReset: function() {
      this.$results.empty();
      this.model.get('results').forEach(this.addSongModel, this);
    },

    addSongModel: function(song) {
      this.$results.append((new views.SearchResult({
        model: song
      })).$el);
    },

    updateLoading: function() {
      if (this.model.get('loading')) {
        this.$el.addClass('loading');
      } else {
        this.$el.removeClass('loading');
      }
    },

    updatePlaceholder: function() {
      if (this.model.get('results').length > 0) {
        this.$placeholder.hide();
      } else {
        this.$placeholder.show();
      }
    },

    render: function() {
      this.$el.html(this.template(this.model.attributes));
      this.$results = this.$('.section-results');
      this.$placeholder = this.$('.section-results-placeholder');
      this.updatePlaceholder();
      this.updateLoading();
    }
  });

  views.Search = Backbone.View.extend({
    events: {
      'click #btn-search': 'search',
      'blur #search-input': 'searchBlurred',
      'keydown #search-input': 'searchKeyDown',
      'paste #search-input': 'searchPaste',
      'mousedown #search-results-list': 'listMouseDown',
      'mousedown #search-input': 'searchInputMouseDown'
    },

    initialize: function(opts) {
      this.ui_hidden = true;
      this.listMousePressed = false;
      this.searchInputMousePressed = false;
      window.bodyView.on('mouseup', function() {
        this.listMousePressed = false;
        this.searchInputMousePressed = false;
      }, this);

      this.queueView = opts.queueView;

      this.section_views = [];
      this.sections = this.model.get('sections');
      this.sections.on('add', this.sectionAdded, this);
      this.sections.forEach(this.sectionAdded, this);

      this.connection = this.model.get('connection');
      this.connection.on('change:connected', this.updateSearchButton, this);

      this.render();
    },

    sectionAdded: function(section) {
      var view = new views.SearchSection({
        model: section
      });
      this.section_views.push(view);
      this.$('#search-results-list').append(view.$el);
    },

    search: function(event) {
      if (event) event.preventDefault();
      this.showUI();
      return false;
    },

    showUI: function() {
      console.log('queueView:', this.queueView);
      this.queueView.hideUI();

      this.ui_hidden = false;
      this.$('#btn-search').tooltip('hide');
      this.$('.search-header').show();
      this.$('#search-input').focus();
      this.$('#search-results-list').show();
      this.updateResultsPlaceholder();
    },

    hideUI: function() {
      this.ui_hidden = true;
      this.$('.search-header').hide();
      this.$('#search-input').val('');
      this.$('#search-results-list').hide();
      this.$('#search-results-placeholder').hide();

      this.queueView.showUI();
    },

    searchBlurred: function() {
      if (this.searchInputMousePressed) return;
      if (this.listMousePressed) {
        window.bodyView.once('mouseup', this.endSearch, this);
      } else {
        this.endSearch();
      }
    },

    endSearch: function() {
      _.defer(_.bind(function() {
        this.model.set('query', '');
        this.hideUI();
      }, this));
    },

    searchKeyDown: function(event) {
      var key = event.keyCode;

      if (key === 27) {
        this.endSearch();
      } else {
        _.defer(_.bind(function() {
          this.model.set({ query: this.$('#search-input').val().trim() });
          this.updateResultsPlaceholder();
        }, this));
      }
    },

    searchPaste: function(event) {
      _.defer(_.bind(function() {
        this.model.set({ query: this.$('#search-input').val().trim() });
        this.updateResultsPlaceholder();
      }, this));
    },

    listMouseDown: function() {
      this.listMousePressed = true;
      this.trigger('listMouseDown');
    },

    searchInputMouseDown: function() {
      this.searchInputMousePressed = true;
      this.trigger('searchInputMouseDown');
    },

    render: function() {
      this.$search_results_list = this.$('#search-results-list');
      this.$btn_search_placeholder = this.$('#btn-search-placeholder');
      this.$results_placeholder = this.$('#search-results-placeholder');
      this.$btn_search = this.$('#btn-search');

      this.$results_placeholder.hide();

      this.$btn_search.tooltip('destroy');
      this.$btn_search.tooltip({
        title: 'Search',
        trigger: 'hover',
        placement: 'left',
        container: 'h1.queue-header',
        delay: {
          show: 400,
          hide: 0
        }
      });

      this.updateSearchButton();
      return this;
    },

    updateResultsPlaceholder: function() {
      if (this.ui_hidden) {
        this.$search_results_list.hide();
        this.$results_placeholder.hide();
      } else if (this.$('#search-input').val().trim().length > 0) {
        this.$search_results_list.show();
        this.$results_placeholder.hide();
      } else {
        this.$search_results_list.hide();
        this.$results_placeholder.show();
      }
    },

    updateSearchButton: function() {
      if (this.connection.get('connected')) {
        this.$btn_search.show();
        this.$btn_search_placeholder.hide();
      } else {
        this.endSearch();
        this.$btn_search_placeholder.show();
        this.$btn_search.hide();
      }
    }
  });

  views.Playback = Backbone.View.extend({
    template: Handlebars.compile($('#playback-template').html()), 

    events: {
      'click .btn-mute': 'mute',
      'click .btn-unmute': 'unmute',
      'click .btn-skip': 'skip',
      'click .btn-skipvote': 'skipvote',
    },

    initialize: function() {
      this.model.on('change:song change:muted', this.render, this);
      this.model.on(
        'change:skipVotes change:skipVotesNeeded', this.updateSkipVotes, this);
      this.model.on('change:progress', this.updateProgress, this);
      this.render();
    },

    progressTimestamp: function() {
      var progress = this.model.get('progress') || 0;
      return secondsToTimestamp(progress);
    },

    durationTimestamp: function() {
      var song = this.model.get('song');
      var duration = song ? song.get('duration') || 0 : 0;
      return secondsToTimestamp(duration);
    },

    updateSkipVotes: function() {
      var canSkipVote = this.model.canSkipVote();
      var hasSkipVotes = (this.model.get('skipVotes') > 0);
      var canSeeSkipVotes = (canSkipVote || hasSkipVotes);

      var $btn = this.$('.btn-skipvote');

      if (canSeeSkipVotes) {
        if (hasSkipVotes) {
          $btn.addClass('btn-value');
        } else {
          $btn.removeClass('btn-value');
        }

        if (canSkipVote) {
          $btn.removeClass('disabled');
          $btn.tooltip({
            title: 'Vote to Skip',
            trigger: 'hover',
            placement: 'left',
            container: '#playback',
            delay: {
              show: 400,
              hide: 0,
            }
          });
          $btn.attr('title', '');
        } else {
          $btn.addClass('disabled');
          $btn.tooltip('destroy');
          $btn.attr('title', 'Votes to Skip Song');
        }

        var valueText = (this.model.get('skipVotes') + '/' +
                         this.model.get('skipVotesNeeded'));

        $btn.find('.value').text(valueText);
        $btn.show();
      } else {
        $btn.hide();
      }
    },

    updateProgress: function() {
      var song = this.model.get('song');
      if (!song) return;

      var progress = this.model.get('progress');
      var duration = song.get('duration');
      var percent = progress / duration * 100;

      this.$('.played-container .played').css('width', percent + '%');
      this.$('.progress-timestamp').text(this.progressTimestamp());
      this.$('.duration-timestamp').text(this.durationTimestamp());
    },

    render: function() {
      var context = {};

      this.$('.btn-mute').tooltip('destroy');
      this.$('.btn-unmute').tooltip('destroy');
      this.$('.btn-skip').tooltip('destroy');
      this.$('.btn-skipvote').tooltip('destroy');

      var attrs = this.model.attributes;
      Object.keys(attrs).forEach(function(key) {
        context[key] = attrs[key];
      });

      if (this.model.has('song')) {
        var songAttrs = this.model.get('song').attributes;
        Object.keys(songAttrs).forEach(function(key) {
          context[key] = songAttrs[key];
        });
      }

      this.undelegateEvents();
      this.$el.html(this.template(context));
      this.delegateEvents();
      this.updateProgress();
      this.updateSkipVotes();

      if (this.model.get('muted')) {
        this.$('.btn-unmute').tooltip({
          title: 'Unmute Audio',
          trigger: 'hover',
          placement: 'left',
          container: '#playback',
          delay: {
            show: 400,
            hide: 0
          }
        });
      } else {
        this.$('.btn-mute').tooltip({
          title: 'Mute Audio',
          trigger: 'hover',
          placement: 'left',
          container: '#playback',
          delay: {
            show: 400,
            hide: 0
          }
        });
      }

      this.$('.btn-skip').tooltip({
        title: 'Skip Song',
        trigger: 'hover',
        placement: 'left',
        container: '#playback',
        delay: {
          show: 400,
          hide: 0
        }
      });

      return this;
    },

    mute: function(event) {
      this.model.mute();
      event.preventDefault();
      return false;
    },

    unmute: function(event) {
      this.model.unmute();
      event.preventDefault();
      return false;
    },

    skip: function(event) {
      this.model.skip();
      event.preventDefault();
      return false;
    },

    skipvote: function(event) {
      this.model.skipVote();
      event.preventDefault();
      return false;
    }
  });
});

