/* upload.js
 * Handles song uploads.
 */
/*jshint es5: true */

var config = require('../../config');
var winston = require('winston');
var fs = require('fs');
var Q = require('q');
var multiparty = require('multiparty');
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

exports.initHandlers = function(app, auth) {
  app.post('/song/upload', function(req, res, next) {
    res.plaintext = true;
    auth.getUser(false, req, res, next, function(user) {

      if (!user) {
        res.status(403);
        res.end(JSON.stringify({
          error: 'Please log in.'
        }));
        return;
      }

      var form = new multiparty.Form({
        autoFiles: true,
        maxFields: 2
      });

      form.on('file', function(name, file) {
        if (file.size > config.web.max_file_size * 1048576) {
          next(new Error(
              'File exceeds ' + config.web.max_file_size + ' MiB.'));
          return;
        }

        var adding = songs.addSong(file.path, user, file.originalFilename);

        if (adding && adding.id) {
          res.status(200);
          res.end(JSON.stringify({
            id: adding.id
          }));
        } else {
          res.status(500);
          res.end(JSON.stringify({
            error: 'Error processing song.'
          }));
          winston.error('addSong() returned invalid adding object.');
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

