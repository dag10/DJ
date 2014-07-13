/* queue.js
 * Logic functions relating to a user's queued songs.
 */
/*jshint es5: true */

var winston = require('winston');
var Queue = require('./queue');
var user_model = require('../../models/user');
var Q = require('q');

var queues = {};

/**
 * Gets a queue for a given user ID.
 *
 * @param user_id ID of the user to fetch the queue from.
 * @return Promise resolving to the queue entity from the user.
 */
exports.getQueue = function(user_id) {
  var deferred = Q.defer();

  user_model.Model
  .find(user_id)
  .then(function(user) {
    if (queues[user_id]) {
      deferred.resolve(queues[user_id]);
      return;
    }

    var queue = new Queue();

    queue.once('load', function() {
      queues[user_id] = queue;
      deferred.resolve(queue);
    });

    queue.once('error', function(err) {
      err.message = 'Failed to fetch queue for userID ' +
        user_id + ': ' + err.message;
      deferred.reject(err);
    });

    queue.user_id = user_id;
    queue.user = user;
    queue.fetch();
  })
  .catch(function(err) {
    err.message = 'Failed to find user for userID ' +
      user_id + ': ' + err.message;
    deferred.reject(err);
  });

  return deferred.promise;
};

/**
 * Adds a song entity to the queue of a user.
 *
 * @param song Song instance to add to the queue.
 * @param user User instance enqueue for.
 * @return Promise resolving with the QueuedSong instance of the queueing.
 */
exports.addSongToQueue = function(song, user) {
  return exports.getQueue(user.id)
  .then(function(queue) {
    return queue.addSongEntity(song);
  });
};

