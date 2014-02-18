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

    this.set({
      finishedTimeout: setTimeout(
        _.bind(this.finished, this), this.millisecondsRemaining())
    });

    this.trigger('play');
  },

  _stop: function() {
    this.set({ playing: false });
    
    if (this.has('finishedTimeout')) {
      clearTimeout(this.get('finishedTimeout'));
      this.unset('finishedTimeout');
    }

    this.unset('song');
    this.unset('dj');
    this.unset('timeStarted');

    this.trigger('end');
  },

  stop: function() {
    this._stop();
    this.trigger('stop');
  },

  finished: function() {
    this._stop();
    this.trigger('finish');
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

  millisecondsRemaining: function() {
    if (!this.has('timeStarted'))
      return 0;

    return (
      (this.song().duration * 1000) + 
      new Date().valueOf() - this.get('timeStarted').valueOf());
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

      // ms elapsed since song start
      ret.elapsed = new Date().valueOf() - this.get('timeStarted').valueOf();

      if (song.artwork) {
        ret.artwork_path = '/artwork/' + song.artwork.filename;
      }
    }

    return ret;
  }
});

