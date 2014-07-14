/* upload.js
 * A song source for uploaded files.
 * 
 * This song source is special in that most of it is actually implemented
 * as part of the core DJ code, and doesn't actually handle file uploads.
 *
 * Do not use this as an example for creating third-party song sources.
 */
/*jshint es5: true */

var Sequelize = require('sequelize');
var song_model = require('../models/song');
var file_model = require('../models/file');

var log;

/**
 * Name of song source.
 */
exports.name = 'upload';

/**
 * Name of song source to display in search results.
 */
exports.display_name = 'Uploaded Songs';

/** Initialize the song source.
 *
 * args:
 *  logger: Logging object. Call functions (debug|info|warn|error) to log.
 *  callback: Function to call when song source is fully loaded.
 *            If there was an error loading, pass an Error object.
 */
exports.init = function(logger, callback) {
  log = logger;
  callback();
};

/** Get song result for a search string.
 *
 * args:
 *   max_results: Maximum number of results to return.
 *   query: String which is partial match of either the title, album, or
 *          artist. This should match this string to any position within these
 *          properties.
 *   callback: Function to call when song results have been retrieved.
 *             This function accepts an array of objects with the following
 *             properties:
 *               id: String of the song ID. This can be whatever makes the
 *                   most sense for your service. It must be unique among all
 *                   songs available in your service.
 *               title: Title of song.
 *               artist: Artist of song.
 *               album: Album of song.
 *               image_url: URL of album art image.
 *             If there are no results, or there is an error, just return an
 *             empty array.
 */
exports.search = function(max_results, query, callback) {
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
    callback(songs.map(function(song) {
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
    callback([]);
  });
};

/** Fetches the song of the specified id.
 *
 * args:
 *   id: String of the song's ID to fetch. This is the ID your service returned
 *       in the search results.
 *   download_location: Directory to store the song file in temporarily.
 *   callback: Function to call when the song is downloaded. If the song was
 *             successfully downloaded, pass the full location of the song.
 *             If there was an error, pass an Error object describing it.
 */
exports.fetch = function(id, download_location, callback) {
  callback(new Error('Not implemented yet!'));
};

