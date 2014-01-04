/* upload.js
 * Handles song uploads.
 */

var config = require('./config');
var winston = require('winston');
var fs = require('fs');
var multiparty = require('multiparty');
var songs = require('./songs');

var song_path = 'songs';
var converted_song_path = 'converted_songs';
var artwork_path = 'artwork';

var upload_dir = config.uploads_directory;
var song_dir = upload_dir + '/' + song_path;
var converted_song_dir = upload_dir + '/' + converted_song_path;
var artwork_dir = upload_dir + '/' + artwork_path;

exports.song_path = song_path;
exports.artwork_path = artwork_path;
exports.upload_dir = upload_dir;
exports.song_dir = song_dir;
exports.artwork_dir = artwork_dir;

exports.init = function() {
  [upload_dir, song_dir, artwork_dir].forEach(
    function(dir) {
      if (!fs.existsSync(dir)) {
        fs.mkdir(dir);
        winston.info('Created directory: ' + dir);
      }
    }
  );
};

exports.initHandlers = function(app, auth) {
  app.post('/song/upload', function(req, res, next) {
    res.plaintext = true;
    auth.getUser(true, req, res, next, function(user) {

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

        songs.addSong(file.path, user, function(song, err) {
          if (err) {
            next(err);
          } else {
            winston.info('ADDED SONG:' + require('util').format(song));
            res.status(200);
            res.end();
          }
        });
      });

      form.on('error', next);
      form.parse(req);
    });
  });
};

