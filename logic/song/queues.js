/* queue.js
 * Logic functions relating to a user's queued songs.
 */

var winston = require('winston');
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
  exports.getQueue(user.id, function(queue) {
    if (queue instanceof Error) {
      winston.error('Failed to get queue to add song!');
      callback({ error: queue });
      return;
    }

    queue.once('reorder', function() {
      callback({});
    });
    queue.addSongEntity(song);
  });
};

