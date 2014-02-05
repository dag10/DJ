/* song_playback.js
 * Model representing the playback of a song.
 */

var _ = require('underscore');
var Backbone = require('backbone');

module.exports = Backbone.Model.extend({
  defaults: {
    playing: false
  },

  /* Playback Control */

  play: function(song_entity, dj) {
    if (this.playing())
      this._stop();

    this.set({
      song: song_entity,
      dj: dj,
      timeStarted: new Date(),
      playing: true
    });

    this.trigger('play');
  },

  _stop: function() {
    this.set({ playing: false });
    
    this.unset('song');
    this.unset('dj');
    this.unset('timeStarted');

    this.trigger('end');
  },

  stop: function() {
    this._stop();
    this.trigger('stop');
  },

  /* Getters */

  song: function() {
    return this.get('song');
  },

  dj: function() {
    return this.get('dj');
  },

  playing: function() {
    return this.get('playing');
  },

  toJSON: function() {
    var ret = {
      playing: this.playing()
    };

    var song = this.song();
    if (song) {
      ret.title = song.title;
      ret.artist = song.artist;
      ret.album = song.album;
      ret.duration = song.duration;
    }

    if (song.artwork) {
      ret.artwork_path = '/artwork/' + song.artwork.filename;
    }

    return ret;
  }
});

