/* queue_manager.js
 * Backbone collection to manage queued_songs. Represents a user's queue.
 */
/*jshint es5: true */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');
var queued_song_model = require('../../models/queuedsong');
var song_model = require('../../models/song');
var file_model = require('../../models/file');
var user_model = require('../../models/user');
var QueuedSong = require('./queued_song');
var Q = require('q');

module.exports = Backbone.Collection.extend({
  comparator: 'order',
  model: QueuedSong,

  initialize: function() {
    this.on('add', this.songAdded, this);
    this.on('remove', this.songRemoved, this);
  },

  songAdded: function(queued_song) {
    queued_song.on('change:order', this.sort, this);
    queued_song.on('change', function() {
      this.trigger('songChanged', queued_song);
    }, this);
  },

  songRemoved: function(removed_queued_song) {
    var removed_order = removed_queued_song.get('order');
    this.forEach(function(queued_song) {
      if (queued_song.get('order') > removed_order)
        queued_song.decrementOrder();
    });
    removed_queued_song.destroy();
  },

  getNextSong: function() {
    return this.first();
  },

  getPlayingSong: function() {
    return this.findWhere({ playing: true });
  },

  addSongEntity: function(song_entity) {
    var deferred = Q.defer();

    queued_song_model.Model.create({
      SongId: song_entity.id,
      UserId: this.user_id,
      order: this.length + 1
    },
    {
      raw: true
    })
    .then(_.bind(function(queued_song) {
      var queuedSongBackbone = new QueuedSong({ instance: queued_song });
      queuedSongBackbone
      .getAssociations(queuedSongBackbone)
      .then(_.bind(function() {
        this.add(queuedSongBackbone);
        deferred.resolve(queued_song);
      }, this));
    }, this))
    .catch(deferred.reject);

    return deferred.promise;
  },

  rotate: function() {
    this.updateSongOrder(this.getNextSong().id, this.length);
  },

  updateSongOrder: function(queued_song_id, order) {
    var target_queued_song = this.get(queued_song_id);
    var original_order = target_queued_song.get('order');
    var moved_down = order > original_order; // directionally, not numerically

    if (order === original_order)
      return;

    this.forEach(function(queued_song) {
      if (
          !moved_down &&
          queued_song.id !== queued_song_id &&
          queued_song.get('order') >= order &&
          queued_song.get('order') < original_order) {
        queued_song.incrementOrder();
      } else if (
          moved_down &&
          queued_song.id !== queued_song_id &&
          queued_song.get('order') <= order &&
          queued_song.get('order') > original_order) {
        queued_song.decrementOrder();
      }
    });
    this.get(queued_song_id).set({ order: order });
  },

  sync: function(method, model) {
    if (!this.user_id) {
      winston.error('Can\'t fetch queue; no user_id set.');
      this.trigger('error', new Error('No user ID specified.'));
      return;
    }

    queued_song_model.Model
    .findAll({
      where: {
        UserId: this.user_id
      },
      order: '`order` ASC',
      include: [
        {
          model: song_model.Model,
          as: 'Song',
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
        }
      ]
    })
    .catch(_.bind(function(err) {
      winston.error(err.message);
    }, this))
    .then(_.bind(function(queued_songs) {
      this.reset();

      // While adding queueings to collection, ensure that orders are
      // consecutive and starting at 1.
      var nextOrder = 1;
      queued_songs.forEach(_.bind(function(queued_song) {
        var new_queued_song = new QueuedSong({ instance: queued_song });
        if (new_queued_song.get('order') === nextOrder) {
          this.add(new_queued_song);
        } else {
          new_queued_song.once('save', function() {
            this.add(new_queued_song);
          }, this);
          new_queued_song.set({ order: nextOrder });
        }
        nextOrder++;
      }, this));
      this.trigger('load');
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

