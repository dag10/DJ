/* queue.js
 * Logic functions relating to a user's queued songs.
 */

var winston = require('winston');
var queued_song_model = require('../../models/queued_song');
var connections = require('../connection/connections');
var Queue = require('./queue');

var queues = {};

exports.getQueue = function(user_id, callback) {
  if (queues[user_id]) {
    callback(queues[user_id]);
    return;
  }

  var queue = new Queue();

  queue.once('load', function() {
    queues[user_id] = queue;
    callback(queue);
  });

  queue.once('error', function(err) {
    callback(err);
  });

  queue.user_id = user_id;
  queue.fetch();
};

exports.addSongToQueue = function(song, user, callback) {
  var queuedSong = new queued_song_model.QueuedSong({
    song: song,
    user: user,
    order: -1
  });

  queuedSong.save(function(err) {
    if (err) {
      callback({ error: err });
    } else {
      winston.info(
        'Added song "' + song.getLogName() + '" to queue of user: ' +
        user.getLogName());
      exports.reorderQueue(user, function(err) {
        if (err)
          callback({ error: err });
        else
          callback({ queuedSong: queuedSong });
      });
    }
  });
};

exports.reorderQueue = function(user, callback) {
  var index = 1;

  var queuedSongs = queued_song_model.QueuedSong.find({
    user: user
  }).orderRaw('?? ASC', ['order']).each().forEach(function(ent) {
    ent.order = index++;
  }).save(function(err) {
    if (err) {
      winston.error(
        'Failed to reorder queue for "' + user.getLogName() + '": ' +
        err.message);
      callback(err);
    } else {
      winston.info('Reordered queue for: ' + user.getLogName());
      // TODO alert user instances of queue change
      callback();
    }
  });
};

