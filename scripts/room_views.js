$(function() {
  var views = window.views = {};

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
        $('.room-alert').text('');
      else if (this.model.has('kick_message'))
        $('.room-alert').text(
          'You were kicked: ' + this.model.get('kick_message'));
      else
        $('.room-alert').text('Disconnected.');
    }
  });

  views.User = Backbone.View.extend({
    template: Handlebars.compile($('#user-template').html()), 

    render: function() {
      this.$el.html(this.template(this.model.attributes));

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

  views.QueuedSong = Backbone.View.extend({
    tagName: 'li',

    template: Handlebars.compile($('#queue-item-template').html()), 

    initialize: function() {
      this.model.on('reindex', this.reindex, this);
      this.model.on('change:playing', this.render, this);
    },

    events: {
      'drop': 'drop',
      'click .btn-remove': 'remove'
    },

    drop: function(event, index) {
      this.$el.trigger('sorted', [this.model, index]);
    },

    remove: function(event) {
      this.model.removeFromQueue();
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

    render: function() {
      this.undelegateEvents();
      this.$el.html(this.template(this.model.attributes));
      this.delegateEvents();
      this.$el.disableSelection();

      if (this.model.get('playing'))
        this.$el.addClass('playing');
      else
        this.$el.removeClass('playing');

      return this;
    }
  });

  views.Queue = Backbone.View.extend({
    events: {
      'sorted #queue-list': 'sorted'
    },

    initialize: function(opts) {
      this.views = [];

      this.connection = opts.connection;
      this.connection.on('change:connected', this.updatePlaceholder, this);

      this.collection.each(_.bind(this.add, this));
      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('reset', this.reset, this);
      this.collection.on('change:playing', this.updateSkipButton, this);

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
      var $placeholder = this.$('.section-empty');

      if (this.connection.get('connected') && this.collection.length === 0)
        $placeholder.show();
      else
        $placeholder.hide();
    },

    sorted: function(event, model, position) {
      model.changePosition(position + 1);
    }
  });

  views.Search = Backbone.View.extend({
    events: {
      'click #btn-search': 'search',
      'blur #search-input': 'endSearch',
      'keydown #search-input': 'searchKeyDown'
    },

    initialize: function(opts) {
      this.connection = opts.connection;
      this.connection.on('change:connected', this.updateSearchButton, this);

      this.render();
    },

    search: function(event) {
      event.preventDefault();
      this.$('#btn-search').tooltip('hide');
      this.$('.search-header').show();
      this.$('.queue-header').hide();
      this.$('#search-input').focus();
      return false;
    },

    endSearch: function() {
      this.$('.queue-header').show();
      this.$('.search-header').hide();
      this.$('#search-input').val('');
    },

    searchKeyDown: function(event) {
      var key = event.keyCode;

      if (key === 27) {
        this.endSearch();
      }
    },

    render: function() {
      this.$('#btn-search').tooltip('destroy');

      this.$('#btn-search').tooltip({
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

    updateSearchButton: function() {
      var $searchBtn = this.$('#btn-search');
      var $searchPlaceholder = this.$('#btn-search-placeholder');

      if (this.connection.get('connected')) {
        $searchBtn.show();
        $searchPlaceholder.hide();
      } else {
        this.endSearch();
        $searchPlaceholder.show();
        $searchBtn.hide();
      }
    }
  });

  views.Playback = Backbone.View.extend({
    template: Handlebars.compile($('#playback-template').html()), 

    events: {
      'click .btn-mute': 'mute',
      'click .btn-unmute': 'unmute',
      'click .btn-skip': 'skip'
    },

    initialize: function() {
      this.model.on('change:song change:muted', this.render, this);
      this.model.on('change:progress', this.updateProgress, this);
      this.render();
    },

    secondsToTimestamp: function(seconds) {
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
    },

    progressTimestamp: function() {
      var progress = this.model.get('progress') || 0;
      return this.secondsToTimestamp(progress);
    },

    durationTimestamp: function() {
      var song = this.model.get('song');
      var duration = song ? song.get('duration') || 0 : 0;
      return this.secondsToTimestamp(duration);
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
    }
  });
});

