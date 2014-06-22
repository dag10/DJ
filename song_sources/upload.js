/* upload.js
 * A song source for uploaded files.
 * 
 * This song source is special in that most of it is actually implemented
 * as part of the core DJ code, and doesn't actually handle file uploads.
 *
 * Do not use this as an example for creating third-party song sources.
 */

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
 *  callback: Function to call when song source is fully loaded.
 *            If there was an error loading, pass an Error object.
 */
exports.init = function(callback) {
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
  // TODO: Actually return results existing in database.

  var results = [];

  for (var i = 0; i < max_results; i++) {
    results.push({
      id: i,
      title: "Result " + i + '!',
      artist: query,
      album: "Some Album",
      image_url: "http://placehold.it/32&text=" + (i + 1)
    });
  }

  callback(results);
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

