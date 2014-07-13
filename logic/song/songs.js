/* songs.js
 * Manages songs.
 */
/*jshint es5: true */

var winston = require('winston');
var config = require('../../config');
var fs = require('fs');
var fs_ = require('../../utils/fs');
var upload = require('./upload');
var ffmpeg = require('fluent-ffmpeg');
var file_model = require('../../models/file');
var song_model = require('../../models/song');
var queues = require('./queues');
var crypto = require('crypto');
var Q = require('q');

/** Encoding stages to show to user as progress. */
exports.stages = {
  transcoding: 'transcoding',
  metadata: 'metadata',
  artwork: 'artwork',
  saving: 'saving',
  added: 'added',
};

/**
 * Processes and adds a song to the system
 *
 * @param path The full path to the media file.
 * @param user The user model.
 * @param name The original filename of the song.
 * @return An object containing an id of the song adding process, and a promise
 *         resolving with the added song, notifying of the current stage, and
 *         rejecting with any errors.
 */
function processSong(path, user, name) {
  var deferred = Q.defer();
  var retObj = {
    id: Math.round(Math.random() * 100000),
    promise: deferred.promise
  };

  // Make sure the provided file exists.
  if (!fs.existsSync(path)) {
    deferred.reject(new Error('Song path does not exist.'));
    return retObj;
  }

  // Send initial stage.
  setTimeout(function() {
    deferred.notify(exports.stages.transcoding);
  }, 0);

  // TODO: Delete these dummy events and actually process the song.
  setTimeout(function() {
    deferred.notify(exports.stages.metadata);
  }, 300);
  setTimeout(function() {
    deferred.notify(exports.stages.artwork);
  }, 600);
  setTimeout(function() {
    //deferred.reject(new Error('Not implemented yet, dawg!'));
    deferred.resolve({});
  }, 900);

  return retObj;
}

/**
 * Enqueues a song for a user.
 *
 * @param song The song model.
 * @param user The user model.
 * @return A promise resolving with the QueuedSong model once enqueued.
 *         The promise notifies of changes in stage.
 */
function enqueueSong(song, user) {
  var deferred = Q.defer();

  // TODO: Delete these dummy events and actually enqueue the song.
  setTimeout(function() {
    deferred.notify(exports.stages.saving);
  }, 600);
  setTimeout(function() {
    if (Math.random() > 0.5)
      deferred.reject(new Error('Enqueueing still broken.'));
    else
      deferred.resolve({});
  }, 1000);

  return deferred.promise;
}

/**
 * Adds and optionally enqueues a media file to one's queue.
 *
 * @param path The full path to the media file.
 * @param user The user model.
 * @param name The original filename of the song.
 * @return An object containing an id of the song adding process, and a promise
 *         resolving with the added song, notifying of the current stage, and
 *         rejecting with any errors.
 */
function addSong(path, user, name) {
  var process = processSong(path, user, name);
  
  return {
    id: process.id,
    promise: process.promise.then(function(song) {
      return enqueueSong(song, user);
    })
  };
}

exports.addSong = addSong;

