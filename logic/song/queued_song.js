/* queued_song.js
 * A Backbone wrapper for the queued_song model.
 */

var BackboneDBModel = require('../backbone_db_model');
var queued_song_model = require('../../models/queued_song');

module.exports = BackboneDBModel.extend({
  defaults: {
    playing: false,
    autosave: true
  },

  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
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

  getLogName: function() {
    return this.get('song').getLogName();
  },

  toJSON: function() {
    var song = this.get('song');

    var artwork_file = song.artwork;
    var song_file = song.file;

    return {
      order: this.get('order'),
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      playing: this.get('playing'),
      id: this.id,
      song_id: song.id,
      song_path: '/songs/' + song.file.filename,
      artwork_path: (
        artwork_file ? '/artwork/' + artwork_file.filename : null)
    };
  }
});

