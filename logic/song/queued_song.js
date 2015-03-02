/* queued_song.js
 * A Backbone wrapper for the queued_song model.
 */
/*jshint es5: true */

var BackboneDBModel = require('../backbone_db_model');
var queued_song_model = require('../../models/queuedsong');
var song_model = require('../../models/song');
var user_model = require('../../models/user');
var file_model = require('../../models/file');
var winston = require('winston');
var _ = require('underscore');
var Q = require('q');

module.exports = BackboneDBModel.extend({
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

  song: function() {
    return this.get('Song');
  },

  user: function() {
    return this.get('User');
  },

  setAssociations: function(instance) {
    if (!instance) instance = this.get('instance');
    var opts = [];

    if (this.has('Song')) {
      opts.push(instance.setSong(this.song()));
    }

    if (this.has('User')) {
      opts.push(instance.setUser(this.user()));
    }
    
    return Q.all(opts).then(_.bind(function() {
      this.trigger('associations:save');
    }, this));
  },

  getAssociations: function(instance) {
    if (!instance) instance = this.get('instance');

    var songPromise = song_model.Model
    .find({
      where: {
        id: instance.attributes.SongId
      },
      include: [
        {
          model: file_model.Model,
          as: 'File'
        },
        {
          model: file_model.Model,
          as: 'Artwork'
        }
      ]
    })
    .then(_.bind(function(song) {
      this.set({ Song: song }, { silent: true });
    }, this));

    var userPromise = user_model.Model
    .find(instance.attributes.UserId)
    .then(_.bind(function(user) {
      this.set({ User: user }, { silent: true });
    }, this));

    return Q.all([
      songPromise,
      userPromise
    ])
    .then(_.bind(function() {
      this.trigger('associations:load');
      this.trigger('change:Song', this.song());
      this.trigger('change:User', this.user());
      return Q();
    }, this))
    .catch(_.bind(function(err) {
      winston.error(
        'Failed to load song and user associations for queuedsong ' +
        this.getLogName() + ': ' + err.stack);
    }, this));
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
    var song = this.song();
    if (song) {
      return song.title + ' (S:' + song.id + ', QS:' + this.id + ')';
    } else {
      return this.get('instance').getLogName();
    }
  },

  toJSON: function() {
    var song = this.song();

    var artwork_file = song.Artwork;
    var song_file = song.File;

    return {
      order: this.get('order'),
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      playing: this.get('playing'),
      id: this.id,
      song_id: song.id,
      song_path: '/songs/' + song_file.filename,
      artwork_path: (
        artwork_file ? '/artwork/' + artwork_file.filename : null)
    };
  }
});

