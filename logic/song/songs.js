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
  transcoding: 'Transcoding',
  metadata: 'Extracting metadata',
  artwork: 'Extracting artwork',
  saving: 'Saving',
};

/**
 * Processes and adds a song to the system
 *
 * @param path The full path to the media file.
 * @param user The user model.
 * @param name The original filename of the song.
 * @return A promise resolving with the song model.
 */
function processSong(path, user, name) {
  var deferred = Q.defer();

  // Make sure the provided file exists.
  if (!fs.existsSync(path)) {
    deferred.reject(new Error('Song path does not exist.'));
    return deferred.promise;
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
    deferred.resolve();
  }, 900);

  return deferred.promise;
}

/**
 * Adds and optionally enqueues a media file to one's queue.
 *
 * @param path The full path to the media file.
 * @param user The user model.
 * @param name The original filename of the song.
 * @return A promise resolving with the song model.
 */
function addSong(path, user, name) {
  var deferred = Q.defer();

  return processSong(path, user, name).then(function(song) {
    var deferred = Q.defer();

    // TODO: Delete these dummy events and actually enqueue the song.
    setTimeout(function() {
      deferred.notify(exports.stages.saving);
    }, 600);
    setTimeout(function() {
      deferred.reject(new Error('Enqueueing still broken.'));
    }, 1000);

    return deferred.promise;
  });
}

exports.addSong = addSong;

