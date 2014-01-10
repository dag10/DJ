$(function() {
  window.views = {};

  window.views.Room = Backbone.View.extend({
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
});

