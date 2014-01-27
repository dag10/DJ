/* queue_manager.js
 * Backbone collection to manage queued_songs. Represents a user's queue.
 */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');
var queued_song_model = require('../../models/queued_song');
var QueuedSong = require('./queued_song');

module.exports = Backbone.Collection.extend({
  model: QueuedSong,

  initialize: function() {
    this.on('add remove', this.reorder, this);
  },
  
  addSongEntity: function(song_entity) {
    var queued_song = new QueuedSong({
      song: song_entity,
      song_id: song_entity.id,
      user_id: this.user_id,
      order: 0
    });
    queued_song.on('save', function() {
      this.add(queued_song);
    }, this);
    queued_song.save();
  },

  reorder: function() {
    var index = 1;
    this.sortBy(function(queued_song) {
      return queued_song.get('order');
    }).forEach(function(queued_song) {
      queued_song.set({ order: index++ });
    });
    this.trigger('reorder');
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
      if (songs_left === 0) {
        this.trigger('load');
        return;
      }
      queued_songs.forEach(_.bind(function(queued_song) {
        this.reset();

        // Because autoFetch doesn't seem to work (godammit), we'll manually
        // fetch the artwork file entity.
        queued_song.song.getArtwork(_.bind(function(err, artwork) {
          if (artwork && !err)
            queued_song.song.artwork = artwork;
          var new_queued_song = new QueuedSong({ entity: queued_song });
          new_queued_song.on('change', function() {
            this.trigger('change');
          }, this);
          this.add(new_queued_song, { silent: true });
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

