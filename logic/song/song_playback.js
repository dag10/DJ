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
    this.set({
      song: song_entity,
      dj: dj,
      timeStarted: new Date(),
      playing: true
    });

    this.trigger('play');
  },

  stop: function() {
    this.set({ playing: false });
    
    this.unset('song');
    this.unset('dj');
    this.unset('timeStarted');

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
  }
});

