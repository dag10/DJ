$(function() {
  window.models = {};

  window.models.Room = Backbone.Model.extend({
    defaults: {
      anonymous_listeners: 0
    },

    initialize: function(options) {
      console.log('Initialized room:', options);
    }
  });
});

