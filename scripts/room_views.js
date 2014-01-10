$(function() {
  var views = window.views = {};

  views.Room = Backbone.View.extend({
    initialize: function() {
      this.model.on(
          'change:anonymous_listeners', this.renderNumAnonymous, this);
      this.model.on(
          'change:name', this.updateRoomName, this);
      this.model.on(
          'change:connected', this.renderRoomName, this);
      this.model.on(
          'change:connected', this.renderAlert, this);

      this.render();
    },

    render: function() {
      this.renderNumAnonymous();
      this.renderRoomName();
      this.renderAlert();
    },

    renderNumAnonymous: function() {
      var num = this.model.get('anonymous_listeners');
      var s = num == 1 ? '' : 's';
      $('#num-anonymous').text(num + ' Anonymous Listener' + s);
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
});

