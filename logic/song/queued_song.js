/* queued_song.js
 * A Backbone wrapper for the queued_song model.
 */

var BackboneDBModel = require('../backbone_db_model');
var queued_song_model = require('../../models/queued_song');

module.exports = BackboneDBModel.extend({
  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.on('change:order', function() {
      var old = this.previous('order');
      var curr = this.get('order');
      console.log('ORDER CHANGED FROM ' + old + ' to ' + curr);
    }, this);
  },

  model: function() {
    return queued_song_model.QueuedSong;
  },

  incrementOrder: function() {
    this.set({
      order: this.get('order') + 1
    });
  },

  decrementOrder: function() {
    this.set({
      order: this.get('order') - 1
    });
  },

  toJSON: function() {
    var song = this.get('song');

    var artwork_file = song.artwork;

    return {
      order: this.get('order'),
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      id: this.id,
      song_id: song.id,
      artwork_path: (artwork_file ? '/artwork/' + artwork_file.filename : null)
    };
  }
});

