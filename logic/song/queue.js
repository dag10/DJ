/* queue_manager.js
 * Backbone collection to manage queued_songs. Represents a user's queue.
 */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');
var queued_song_model = require('../../models/queued_song');
var file_model = require('../../models/file');
var QueuedSong = require('./queued_song');

module.exports = Backbone.Collection.extend({
  model: QueuedSong,

  reorder: function() {
    // TODO
    winston.info('Reordering queue for ' + this.user_id); // TODO delete
  },

  sync: function(method, model) {
    if (!this.user_id) {
      winston.error('Can\'t fetch queue; no user_id set.');
      this.trigger('error', new Error('No user ID specified.'));
      return;
    }

    queued_song_model.QueuedSong.find({
      user_id: this.user_id
    }, _.bind(function(err, queued_songs) {
      var songs_left = queued_songs.length;
      queued_songs.forEach(_.bind(function(queued_song) {

        // Because autoFetch doesn't seem to work (godammit), we'll manually
        // fetch the artwork file entity.
        queued_song.song.getArtwork(_.bind(function(err, artwork) {
          if (artwork && !err)
            queued_song.song.artwork = artwork;
          this.add(new QueuedSong({ entity: queued_song }), { silent: true });
          if (--songs_left <= 0) this.trigger('load');
        }, this));
      }, this));
    }, this));
  },

  toJSON: function() {
    var songs = [];

    this.models.forEach(function(queued_song) {
      songs.push(queued_song.toJSON());
    });

    return songs;
  }
});

