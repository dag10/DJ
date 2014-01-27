/* queued_song.js
 * A Backbone wrapper for the queued_song model.
 */

var BackboneDBModel = require('../backbone_db_model');
var queued_song_model = require('../../models/queued_song');

module.exports = BackboneDBModel.extend({
  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
  },

  model: function() {
    return queued_song_model.QueuedSong;
  },

  toJSON: function() {
    var data = {
      order: this.get('order')
    };

    var song = this.get('song');

    Object.keys(song).forEach(function(song_key) {
      data[song_key] = song[song_key];
    });

    return data;
  }
});

