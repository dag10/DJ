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
        window.document.title = name;
      else
        window.document.title = 'Disconnected';
    },

    renderAlert: function() {
      if (this.model.get('connected'))
        $('.room-alert').text('');
      else
        $('.room-alert').text('Disconnected.');
    }
  });
});

