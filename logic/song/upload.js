/* upload.js
 * Handles song uploads.
 */
/*jshint es5: true */

var config = require('../../config');
var winston = require('winston');
var fs = require('fs');
var Q = require('q');
var _ = require('underscore');
var multiparty = require('multiparty');
var auth = require('../auth');
var songs = require('./songs');
var connections = require('../connection/connections');

var song_path = 'songs';
var artwork_path = 'artwork';

var upload_dir = config.uploads_directory;
var song_dir = upload_dir + '/' + song_path;
var artwork_dir = upload_dir + '/' + artwork_path;

exports.song_path = song_path;
exports.artwork_path = artwork_path;
exports.upload_dir = upload_dir;
exports.song_dir = song_dir;
exports.artwork_dir = artwork_dir;

exports.init = function() {
  var deferred = Q.defer();

  [upload_dir, song_dir, artwork_dir].forEach(
    function(dir) {
      if (!fs.existsSync(dir)) {
        fs.mkdir(dir);
        winston.info('Created directory: ' + dir);
      }
    }
  );

  deferred.resolve();
  return deferred.promise;
};

exports.createWebHandlers = function(app) {
  app.post('/song/upload', function(req, res, next) {
    res.header('Connection', 'close');
    res.plaintext = true;
    
    auth.getSessionUser(req, res)
    .catch(function(err) {
      renderResult(res, 'error.ejs', {
        header: 'Authentication failed unexpectedly.',
        error: err,
      });
    })
    .then(function(user) {
      if (!user) {
        res.status(403);
        res.end(JSON.stringify({
          error: 'Please log in.'
        }));
        return;
      }

      var form = new multiparty.Form({
        autoFiles: true,
        maxFields: 2,
        maxFilesSize: config.web.max_file_size * 1024 * 1024
      });

      form.on('error', function(err) {
        res.status(413);
        res.end(JSON.stringify({
          error: err.message
        }));
      });

      form.on('file', function(name, file) {
        var adding = songs.addSong(file.path, user, file.originalFilename);

        if (adding && typeof adding.job_id === 'number') {
          res.status(200);
          res.end(JSON.stringify({
            job_id: adding.job_id
          }));
        } else {
          res.status(500);
          res.end(JSON.stringify({
            error: 'Error processing song.'
          }));
          winston.error(
            'addSong() returned invalid adding object: ' +
            JSON.stringify(adding));
        }

        connections
        .connectionsForUsername(user.username)
        .forEach(function(connection) {
          connection.watchSongAdd(adding);
        });
      });

      form.on('error', next);
      form.parse(req);
    });
  });
};

