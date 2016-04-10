/* songs.js
 * Manages songs.
 */
/*jshint es5: true */

var winston = require('winston');
var async = require('async');
var config = require('../../config');
var fs = require('fs');
var fs_ = require('../../utils/fs');
var os = require('os');
var upload = require('./upload');
var ffmpeg = require('fluent-ffmpeg');
var song_source_map_model = require('../../models/songsourcemap');
var file_model = require('../../models/file');
var song_model = require('../../models/song');
var song_sources = require('../../song_sources');
var queues = require('./queues');
var request = require('request');
var extensions = require('../../utils/extensions');
var Q = require('q');

/** Temporary directory for saving extracted album artwork. */
var artworkTmpDir = null;
var artworkTmpId = 1;

/** Incrementing unique ID for song processing jobs. */
var nextJobId = 1;

/** Encoding stages to show to user as progress. */
exports.stages = {
  downloading: 'downloading',
  waiting: 'waiting',
  transcoding: 'transcoding',
  metadata: 'metadata',
  artwork: 'artwork',
  saving: 'saving',
  added: 'added',
};

/**
 * Concurrency-limiting queue for song transcoding jobs.
 */
var transcodingQueue = async.queue(function(func, callback) {
  func().then(callback, callback);
}, config.transcoding.max_concurrent_jobs);

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

  transcodingQueue.push(function() {
    var jobDeferred = Q.defer();

    deferred.notify(exports.stages.transcoding);

    ffmpeg(path)
    .withAudioCodec('libmp3lame')
    .withAudioBitrate(320)
    .format('mp3')
    .on('start', function(command) {
      winston.debug('Running ffmpeg with command: ' + command);
    })
    .on('error', function(err, stdout, stderr) {
      if (!err) return;

      winston.warn(
        'Failed to transcode song: ' + path + '\n\nstderr: ' + stderr +
        '\n\nstdout: ' + stdout);
      jobDeferred.reject(err);
    })
    .on('end', function() {
      console.info('Resolving');
      jobDeferred.resolve();
    })
    .save(newpath);

    return jobDeferred.promise;
  }, function(err) {
    if (err) {
      deferred.reject(err);
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
 * @param metadata Optional metadata to use instead of extracted metadata.
 * @return A promise resolving when the operation is complete.
 */
function extractMetadata(song, path, metadata) {
  metadata = metadata || {};
  var deferred = Q.defer();

  ffmpeg.ffprobe(path, function(err, data) {
    if (!err && !data.format.duration) {
      err = new Error('No duration found.');
    }

    if (err) {
      deferred.reject(err);
      return;
    }

    var tags = data.format.tags || {};

    if (metadata.title) song.title = metadata.title;
    else if (tags.title) song.title = tags.title;

    if (metadata.album) song.album = metadata.album;
    else if (tags.album) song.album = tags.album;

    if (metadata.artist) song.artist = metadata.artist;
    else if (tags.artist) song.artist = tags.artist;

    song.duration = data.format.duration;

    deferred.resolve();
  });

  return deferred.promise;
}

/**
 * Downloads an album art image.
 *
 * @param url The URL of the album art image.
 * @return A promise resolving with the path of the saved album artwork
 *         when the operation is complete. If there's no album art, the promise
 *         is resolved to null.
 */
function downloadArtwork(url) {
  var deferred = Q.defer();

  if (!artworkTmpDir) {
    artworkTmpDir = fs_.createTmpDir();
  }

  var opts = {
    url: url,
    encoding: null,
    timeout: 10 * 1000, // 10 seconds
  };

  request(opts, function(err, res, body) {
    if (err) {
      winston.warn('Failed to download album art from ' + url +
                ': ' + (err.message || err));
      deferred.reject(err);
      return;
    }

    var content_type = res.headers['content-type'];
    var extension = extensions.getExtension(content_type) || 'img';
    var save_path = artworkTmpDir + (artworkTmpId++) + '-tmp.' + extension;
    
    fs.writeFile(save_path, res.body, function(err) {
      if (err) {
        deferred.reject(err);
      } else {
        deferred.resolve(save_path);
      }
    });
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
    artworkTmpDir = fs_.createTmpDir();
  }

  var filenames = [];

  var artworkpath = (artworkTmpDir + '/' + 'artwork_' +
                     filenameOfPath(path) + '.png');
  ffmpeg(path)
  .on('start', function(command) {
    winston.debug('Running ffmpeg with command: ' + command);
  })
  .on('error', function(err, stdout, stderr) {
    if (!err) return;

    winston.debug(
      'Failed to extract screenshot of: ' + path + '\n\nstderr: ' + stderr +
      '\n\nstdout: ' + stdout);
    deferred.resolve(null);
  })
  .on('end', function() {
    deferred.resolve(artworkpath);
  })
  .save(artworkpath);

  return deferred.promise;
}

/**
 * Processes and adds a song to the system
 *
 * @param uploadedpath The full path to the media file.
 * @param user The user model.
 * @param name The original filename of the song.
 * @param opts Object containing optionally any of the following:
 *               source: Name of song source downloaded from, if any.
 *               source_id: ID from source.
 *               title: Title of song.
 *               artist: Artist of song.
 *               album: Album of song.
 *               image_url: URL of album art.
 *             If source and source_id are provided, a song mapping is added
 *             with the source being the original source.
 *             If title is provided, title, album, and artist are used as
 *             metadata, and no metadata is extracted with ffmpeg.
 *             If image_url is provided, the album art is downloaded from there
 *             instead of extracted with ffmpeg.
 * @return A promise resolving with the added song, notifying of the current
 *         stage, and rejecting with any errors.
 */
function processSong(uploadedpath, user, name, opts) {
  var deferred = Q.defer();
  opts = opts || {};

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
    deferred.notify(exports.stages.waiting);
    return transcodeSong(uploadedpath, path);
  })

  // Extract metadata.
  .then(function() {
    deferred.notify(exports.stages.metadata);
    return extractMetadata(song, path, opts);
  })

  // Check song duration.
  .then(function() {
    if (song.duration / 60 > config.max_duration) {
      return Q.reject(new Error(
        'Song cannot be longer than ' + config.max_duration + ' minutes.'));
    }
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

    if (opts.image_url) {
      return downloadArtwork(opts.image_url);
    } else {
      return extractArtwork(path);
    }
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

  // Map song upload for searching.
  .then(function() {
    return Q(song_source_map_model.Model.create({
      source: 'upload',
      sourceId: song.id,
      confirmations: 0,
      original: true
    }))
    .then(function(song_map) {
      return Q(song_map.setSong(song));
    });
  })

  // Map song from song source, if source is provided, for searching.
  .then(function() {
    if (!opts.source || !opts.source_id) return;

    return Q(song_source_map_model.Model.create({
      source: opts.source,
      sourceId: opts.source_id,
      confirmations: 0,
      original: true
    }))
    .then(function(song_map) {
      return Q(song_map.setSong(song));
    });
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
    var message = err.stack || err.message;
    winston.warn('Failed to process song: ' + name + '\n' + message);
    song.destroy();
  })
  .finally(function() {
    // Always delete original song file; it's no longer needed.
    fs_.unlink(uploadedpath, true);
  });

  return deferred.promise;
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
  .then(function(queued_song) {
    deferred.resolve(queued_song);
  })
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
 * @param job_id Optional job_id of an existing job.
 * @return Job object containing an id of the song adding process, and a promise
 *         resolving with the added song, notifying of the current stage, and
 *         rejecting with any errors.
 */
function addSong(path, user, name, job_id) {
  var job = {
    job_id: job_id || createJobId()
  };

  job.promise = processSong(path, user, name)
  .then(function(song) {
    return enqueueSong(song, user);
  });

  return job;
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
      _song = null,
      job = {
        job_id: createJobId(),
        promise: deferred.promise
      };

  song_sources
  .fetch(source, source_id, job, user)
  .then(function(song) {
    _song = song;
    if (user) {
      return enqueueSong(song, user);
    }
  })
  .then(function() {
    deferred.resolve(_song);
  })
  .progress(deferred.notify)
  .catch(function(error) {
    deferred.reject(new Error(error.displaytext || 'Failed to add song.'));
    winston.warn(
      'Failed to add song "' + source_id + '" from source "' + source +
      '": ' + error.stack);
  });

  return job;
}

exports.processSong = processSong;
exports.addSong = addSong;
exports.addFromSearch = addFromSearch;

