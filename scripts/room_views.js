$(function() {
  window.views = {};

  window.views.Room = Backbone.View.extend({
    initialize: function() {
      this.model.on(
          'change:anonymous_listeners', this.renderNumAnonymous, this);
      this.model.on(
          'change:name', this.updateRoomName, this);

      this.render();
    },

    render: function() {
      this.renderNumAnonymous();
      this.updateRoomName();
    },

    renderNumAnonymous: function() {
      var num = this.model.get('anonymous_listeners');
      var s = num == 1 ? '' : 's';
      $('#num-anonymous').text(num + ' Anonymous Listener' + s);
    },

    updateRoomName: function() {
      var name = this.model.escape('name');
      $('.room-name').text(name);
      window.document.title = name;
    }
  });
});

