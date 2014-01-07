$(function() {
  window.models = {};

  window.models.Room = Backbone.Model.extend({
    defaults: {
      anonymous_listeners: 0,
      connected: false
    },

    initialize: function(options) {
      console.log('Initialized room:', options);
    },

    reset: function() {
      this.set({
        anonymous_listeners: 0,
        connected: false
      });
    }
  });
});

