/* queued_song.js
 * A Backbone wrapper for the queued_song model.
 */
/*jshint es5: true */

var NewBackboneDBModel = require('../new_backbone_db_model');
var queued_song_model = require('../../models/queuedsong');
var Q = require('q');

module.exports = NewBackboneDBModel.extend({
  defaults: {
    playing: false,
    autosave: true
  },

  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
  },

  model: function() {
    return queued_song_model.Model;
  },

  setAssociations: function(instance) {
    var opts = [];

    if (this.has('song')) {
      opts.push(instance.setSong(this.get('song')));
    }

    if (this.has('user')) {
      opts.push(instance.setUser(this.get('user')));
    }
    
    return Q.all(opts);
  },

  getAssociations: function(instance) {
    var songDeferred = Q.defer();
    instance
    .getSong()
    .then(_.bind(function(song) {
      this.set({ song: song });
      songDeferred.resolve();
    }, this))
    .catch(songDeferred.reject);

    var userDeferred = Q.defer();
    instance
    .getUser()
    .then(_.bind(function(user) {
      this.set({ user: song });
      userDeferred.resolve();
    }, this))
    .catch(userDeferred.reject);

    return Q.all([
      songDeferred,
      userDeferred,
    ]);
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

