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
          'change:connected', this.renderRoomName, this);
      this.model.on(
          'change:connected', this.renderAlert, this);
      this.model.on(
          'change:dj change:connected', this.renderDJButton, this);

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
      var name = this.model.escape('name');

      $('.room-name').text(name);

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
    render: function() {
      this.$el.text(this.model.get('fullName'));

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
    render: function() {
      this.$el.text(this.model.get('title'));

      return this;
    }
  });

  views.Queue = Backbone.View.extend({
    initialize: function() {
      this.views = [];

      this.collection.each(this.add);
      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('reset', this.reset, this);
      this.collection.on('sort', this.render, this);

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
        tagName: 'li',
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
      var $ul = this.$('ul');
      var $placeholder = this.$('.section-empty');

      var scrollTop = this.el.scrollTop;

      if (this.collection.length === 0)
        $placeholder.show();
      else
        $placeholder.hide();

      $ul.empty();
      this.collection.forEach(function(queuedSong) {
        $ul.append(this.getViewForQueuedSong(queuedSong).render().el);
      }, this);

      this.el.scrollTop = scrollTop;
    }
  });
});

