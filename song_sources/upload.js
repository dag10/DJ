/* upload.js
 * A song source for uploaded files.
 * 
 * This song source is special in that most of it is actually implemented
 * as part of the core DJ code, and doesn't actually handle file uploads.
 *
 * Do not use this as an example for creating third-party song sources.
 */
/*jshint es5: true */

var Q = require('q');
var Sequelize = require('sequelize');
var song_model = require('../models/song');
var file_model = require('../models/file');

/**
 * This module's logging object.
 */
var log;

/**
 * Name of song source.
 */
exports.name = 'upload';

/**
 * Name of song source to display in search results.
 */
exports.display_name = 'Uploaded Songs';

/**
 * Initialize the song source.
 *
 * @param log Logger object. Call functions debug/info/warn/error to log.
 * @param config Configuration object, which is empty if no configuration is
 *               provided.
 * @return Promise resolving when initialization is complete, and rejecting
 *                 with an Error object if an error has occured.
 */
exports.init = function(_log, config) {
  var deferred = Q.defer();

  log = _log;

  deferred.resolve();
  return deferred.promise;
};


/**
 * Get song result for a search string.
 *
 * @param max_results Maximum number of results to return.
 * @param query String which is a partial match of either title, album, or
 *              artist. This function should match this string to any position
 *              within these properties.
 * @return Promise resolving with an array of result objects, or rejecting
 *                 with an error. If no results were found, resolve with an
 *                 empty array.
 *                 Objects in the results array should have the following:
 *                  id: Unique identifier of the song. This should be whatever
 *                      makes the most sense for your service. It must be
 *                      unique among all songs available in your service.
 *                  title: Title of the song.
 *                  artist: Artist of the song. (optional)
 *                  album: Album of the song. (optional)
 *                  image_url: URL of the album art image. (optional)
 */
exports.search = function(max_results, query) {
  var deferred = Q.defer();

  query = query.replace('%', '\\%').replace(/\s+/g, '%');
  query = '%' + query + '%';

  song_model.Model.findAll({
    where: Sequelize.or(
      { title: { like: query } },
      { artist: { like: query } },
      { album: { like: query } }
    ),
    limit: max_results,
    include: [
      {
        model: file_model.Model,
        as: 'Artwork'
      }
    ]
  })
  .then(function(songs) {
    deferred.resolve(songs.map(function(song) {
      return {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        image_url: song.artwork ? '/artwork/' + song.artwork.filename : null
      };
    }));
  })
  .catch(function(err) {
    log.error(
      'Failed to return upload search results for "' + query +
      '": ' + err.stack);
    deferred.reject(err);
  });

  return deferred.promise;
};

/**
 * Fetches the song of the specified id.
 *
 * @param id String of the song's ID to fetch. This is the ID your service
 *           returned in the search results.
 * @param download_location Directory to store the song file in temporarily.
 * @return Promise resolving with full path of the downloaded song file. If
 *         there was an error, the promise is rejected with an Error object.
 */
exports.fetch = function(id, download_location) {
  return Q.reject(new Error('Uploads should not be fetched.'));
};

