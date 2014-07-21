/* songs.js
 * Manages songs.
 */
/*jshint es5: true */

var winston = require('winston');
var config = require('../../config');
var fs = require('fs');
var fs_ = require('../../utils/fs');
var os = require('os');
var upload = require('./upload');
var ffmpeg = require('fluent-ffmpeg');
var file_model = require('../../models/file');
var song_model = require('../../models/song');
var song_sources = require('../../song_sources');
var queues = require('./queues');
var crypto = require('crypto');
var Q = require('q');

/** Temporary directory for saving extracted album artwork. */
var artworkTmpDir = null;

/** Incrementing unique ID for song processing jobs. */
var nextJobId = 1;

/** Encoding stages to show to user as progress. */
exports.stages = {
  downloading: 'downloading',
  transcoding: 'transcoding',
  metadata: 'metadata',
  artwork: 'artwork',
  saving: 'saving',
  added: 'added',
};

/**
 * Generates a new song add job ID.
 *
 * @return Integer value of new job ID.
 */
function createJobId() {
  return nextJobId++;
}

/**
 * Generates a short name for a song from the original name.
 *
 * @param name Original song name, sans extension.
 * @return Shortname.
 */
function generateShortName(name) {
  return name.toLowerCase()
      .replace(/[\s_\-]+/g, '-')
      .replace(/[^\w\-\.]/g, '');
}

/**
 * Returns the filename of a path, disregarding the directories and extension.
 *
 * @param path The file path string.
 * @return The filename of the file.
 */
function filenameOfPath(path) {
  return path.replace(/^.*[\\\/]/, '');
}

/**
 * Removed the extension from a filename string.
 *
 * @param file The filename.
 * @return String of the filename without the extension.
 */
function removeExtension(file) {
  return file.replace(/\.[^\.]*$/, '');
}

/**
 * Changes the extension of a filename/filepath string.
 *
 * @param file String of the filename/path.
 * @param extension Extension to change file to.
 * @return String of the new filename/path with the extension updated.
 */
function changeExtension(file, extension) {
  return removeExtension(file) + '.' + extension;
}

/**
 * Transcodes a song into an mp3.
 *
 * @param path The full path to the media file.
 * @param newpath The full path what to save the converted file as.
 * @return A promise resolving when the operation is complete.
 */
function transcodeSong(path, newpath) {
  var deferred = Q.defer();

  new ffmpeg({ source: path })
    .withAudioCodec('libmp3lame')
    .withAudioBitrate(320)
    .toFormat('mp3')
    .saveToFile(newpath, function(stdout, stderr, err) {
      if (err) {
        winston.warn(
          'Failed to transcode song: ' + path + '\n\nstderr: ' + stderr +
          '\n\nstdout: ' + stdout);
        deferred.reject(err);
      } else if (stderr === 'timeout') {
        deferred.reject(new Error('ffmpeg timed out.'));
      } else {
        deferred.resolve();
      }
    });

  return deferred.promise;
}

/**
 * Extracts metadata from an mp3, storing it in a Song model.
 *
 * @param song The song model to store the metadata in.
 * @param path The full path to the media file.
 * @return A promise resolving when the operation is complete.
 */
function extractMetadata(song, path) {
  var deferred = Q.defer();

  ffmpeg.Metadata(path, function(data, err) {
    if (!err && !data.durationsec) {
      err = new Error('No duration found.');
    }

    if (err) {
      deferred.reject(err);
      return;
    }

    if (data.title) song.title = data.title;
    if (data.album) song.album = data.album;
    if (data.artist) song.artist = data.artist;
    song.duration = data.durationsec;

    deferred.resolve();
  });

  return deferred.promise;
}

/**
 * Extracts album artwork from an audio file.
 *
 * @param path The full path to the audio file.
 * @return A promise resolving with the path of the saved album artwork
 *         when the operation is complete. If there's no album art, the promise
 *         is resolved to null.
 */
function extractArtwork(path) {
  var deferred = Q.defer();

  if (!artworkTmpDir) {
    artworkTmpDir = os.tmpDir();
  }

  new ffmpeg({ source: path })
    .withSize('800x800')
    .takeScreenshots({
      count: 1
    },
    artworkTmpDir,
    function(err, filenames) {
      if (err) {
        winston.info('Failed to extract album art for ' + path);
        filenames.forEach(function(name) {
          fs_.unlink(artworkTmpDir + '/' + name, true);
        });
        deferred.resolve(null);
        return;
      }

      if (filenames.length === 0) {
        deferred.resolve(null);
        return;
      }

      while (filenames.length > 1) {
        fs_.unlink(artworkTmpDir + '/' + filenames.pop());
      }

      deferred.resolve(artworkTmpDir + '/' + filenames[0]);
    });

  return deferred.promise;
}

/**
 * Processes and adds a song to the system
 *
 * @param uploadedpath The full path to the media file.
 * @param user The user model.
 * @param name The original filename of the song.
 * @return An object containing an id of the song adding process, and a promise
 *         resolving with the added song, notifying of the current stage, and
 *         rejecting with any errors.
 */
function processSong(uploadedpath, user, name) {
  var deferred = Q.defer();
  var ret = {
    job_id: createJobId(),
    promise: deferred.promise
  };

  // Create shortname and decide where to save the song.
  // I put a random number in the temporary filename to prevent filename
  // collisions, which could be exploited by users to overwrite the audio
  // of an existing song.
  var rand = 'temp-' + Math.round(Math.random() * 10000) + '-';
  var shortname = generateShortName(removeExtension(name));
  var path = upload.song_dir + '/' +
    rand + changeExtension(shortname, 'mp3');

  // Create a new song model.
  var song = song_model.Model.build({
    title: shortname
  });

  // Make sure file exists.
  fs_.exists(uploadedpath)
  .then(function(exists) {
    if (!exists) return Q.reject(new Error('Song path does not exist.'));
  })

  // Transcode song to mp3.
  .then(function() {
    deferred.notify(exports.stages.transcoding);
    return transcodeSong(uploadedpath, path);
  })

  // Extract metadata.
  .then(function() {
    deferred.notify(exports.stages.metadata);
    return extractMetadata(song, path);
  })
  
  // Save song model.
  .then(function() {
    return song.save();
  })

  // Set uploader of song.
  .then(function() {
    if (user) return song.setUploader(user);
  })

  // Rename file to include song ID.
  .then(function() {
    var deferred = Q.defer();

    var newfilename = song.id + '-' + generateShortName(song.title) + '.mp3';
    var newpath = upload.song_dir + '/' + newfilename;

    fs.rename(path, newpath, function(err) {
      if (err) {
        deferred.reject(err);
      } else {
        path = newpath;
        deferred.resolve();
      }
    });

    return deferred.promise;
  })

  // Create and save File instance pointing to the transcoded song.
  .then(function() {
    var file_instance;
    return file_model.Model.create({
      directory: upload.song_path,
      filename: filenameOfPath(path)
    })
    .then(function(file) {
      file_instance = file;
      return file.setUploader(user);
    })
    .then(function() {
      return song.setFile(file_instance);
    })
    .catch(function() {
      file_instance.destroy();
    });
  })

  // Extract album artwork.
  .then(function() {
    deferred.notify(exports.stages.artwork);
    return extractArtwork(path);
  })

  // Save artwork file model.
  .then(function(artworkpath) {
    if (!artworkpath) return;
    var deferred = Q.defer();

    var newartworkfilename = song.id + '-' +
      generateShortName(song.title) + '.jpg';
    var newartworkpath = upload.artwork_dir + '/' + newartworkfilename;

    fs.rename(artworkpath, newartworkpath, function(err) {
      if (err) {
        deferred.reject(err);
        return;
      }

      var artwork_instance;
      file_model.Model.create({
        directory: upload.artwork_path,
        filename: filenameOfPath(newartworkpath)
      })
      .then(function(artwork) {
        artwork_instance = artwork;
        return Q.all([
          artwork.setUploader(user),
          song.setArtwork(artwork_instance)
        ]);
      })
      .then(deferred.resolve)
      .catch(function(err) {
        artwork_instance.destroy();
        deferred.reject(err);
      });
    });

    return deferred.promise;
  })

  // Pipe results to our deferred, without sending actual error message.
  // Also cleans up if we have to abort.
  .then(function() {
    deferred.resolve(song);
    if (user) {
      winston.info(user.getLogName() + ' added song: ' + song.getLogName());
    } else {
      winston.info('Song added: ' + song.getLogName());
    }
  })
  .progress(deferred.notify)
  .catch(function(err) {
    deferred.reject(new Error('Failed to transcode song.'));
    winston.warn('Failed to process song: ' + name + '\n' + err.stack);
    song.destroy();
  })
  .finally(function() {
    // Always delete original song file; it's no longer needed.
    fs_.unlink(uploadedpath, true);
  });

  return ret;
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

  setTimeout(function() {
    deferred.notify(exports.stages.saving);
  }, 0);

  queues
  .addSongToQueue(song, user)
  .then(deferred.resolve)
  .catch(function(err) {
    deferred.reject(new Error('Failed to enqueue song'));
    winston.warn(
      'Failed to enqueue song: ' + song.getLogName() + '\n' + err.stack);
  });

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
  
  process.promise = process.promise.then(function(song) {
    return enqueueSong(song, user);
  });

  return process;
}

/**
 * Fetches and enqueues a song from a search result.
 *
 * @param source Name of song source.
 * @param source_id Source-specific id string of song to fetch.
 * @param user User entity to enqueue the song for.
 * @return Promise resolving with Song when complete, or rejecting with a
 *                 clean, displayable error.
 */
function addFromSearch(source, source_id, user) {
  var deferred = Q.defer(),
      _song = null;

  song_sources
  .fetch(source, source_id)
  .then(function(song) {
    _song = song;
    return enqueueSong(song, user);
  })
  .then(function() {
    deferred.resolve(_song);
  })
  .progress(deferred.notify)
  .catch(function(error) {
    deferred.reject(new Error('Failed to add song.'));
    winston.warn(
      'Failed to add song "' + source_id + '" from source "' + source +
      '": ' + error.stack);
  });

  return {
    job_id: createJobId(),
    promise: deferred.promise
  };
}

exports.addSong = addSong;
exports.addFromSearch = addFromSearch;

