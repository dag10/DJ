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
    tagName: 'li',

    template: Handlebars.compile($('#queue-item-template').html()), 

    events: {
      'drop': 'drop'
    },

    drop: function(event, index) {
      this.$el.trigger('sorted', [this.model, index]);
    },

    render: function() {
      this.undelegateEvents();
      this.$el.html(this.template(this.model.attributes));
      this.delegateEvents();
      return this;
    }
  });

  views.Queue = Backbone.View.extend({
    events: {
      'sorted': 'sorted'
    },

    initialize: function() {
      this.views = [];

      this.collection.each(_.bind(this.add, this));
      this.collection.on('add', this.add, this);
      this.collection.on('remove', this.remove, this);
      this.collection.on('reset', this.reset, this);
      this.collection.on('sort', this.render, this);
      this.collection.on('update:start', this.updateStarted, this);
      this.collection.on('update:finish', this.updateFinished, this);

      this.$('ul').sortable({
        axis: 'y',
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

    updateStarted: function() {
      this.scrollTop = this.el.scrollTop;
    },

    updateFinished: function() {
      var scrollTop = this.scrollTop || 0;
      if (scrollTop > 0)
        scrollTop += $(this.el.children[0].children[0]).outerHeight();
      this.el.scrollTop = scrollTop;
    },

    render: function() {
      var $ul = this.$('ul');
      var $placeholder = this.$('.section-empty');

      if (this.collection.length === 0)
        $placeholder.show();
      else
        $placeholder.hide();

      $ul.empty();
      this.collection.forEach(function(queuedSong) {
        $ul.append(this.getViewForQueuedSong(queuedSong).render().el);
      }, this);
    },

    sorted: function(event, model, position) {
      model.changePosition(position + 1);
    }
  });
});

