/* songs.js
 * Manages songs.
 */

var winston = require('winston');
var config = require('./config');
var fs = require('fs');
var fs_ = require('./fs');
var upload = require('./upload');
var ffmpeg = require('fluent-ffmpeg');
var file_model = require('./models/file');
var song_model = require('./models/song');

var generateShortName = function(name) {
  return name.toLowerCase().replace(/[\s\-]+/g, '-').replace(/[^\w\-\.]/g, '');
};

var removeExtension = function(file) {
  return file.replace(/\.[^\.]*$/, '');
};

var changeExtension = function(file, extension) {
  return removeExtension(file) + '.' + extension;
};

exports.addSong = function(path, user, callback) {
  if (!fs.existsSync(path)) {
    var err = new Error('Song path does not exist.');
    winston.error(err);
    callback(err);
    return;
  }

  var now = new Date();

  var filename = path.replace(/^.*[\\\/]/, '');
  var shortname = generateShortName(removeExtension(filename));
  var newpath = upload.dir_song + '/' + changeExtension(shortname, 'mp3');
  var screenshots = [];

  var abort = function(err, stderr) {
    if (stderr)
      winston.error(err.message + '\n' + stderr);
    else
      winston.error(err.message);
    callback(null, new Error('Failed to convert file.'));
    fs_.unlink(path);
    fs_.unlink(newpath);
    screenshots.forEach(function(name) {
      fs_.unlink(upload.artwork_dir + '/' + name);
    });
  };

  // Convert file to mp3.
  var proc = new ffmpeg({ source: path })
    .withAudioCodec('libmp3lame')
    .withAudioBitrate(320)
    .toFormat('mp3')
    .saveToFile(newpath, function(stdout, stderr, err) {
      if (err) {
        abort(err, stderr);
        return;
      }

      // Extract album art (if any).
      new ffmpeg({ source: newpath })
        .withSize('800x800')
        .takeScreenshots({
          count: 1
        }, upload.artwork_dir, function(err, filenames) {
          if (err && filenames.length) {
            filenames.forEach(function(name) {
              fs_.unlink(upload.artwork_dir + '/' + name);
            });
          } else if (!err) {
            screenshots = filenames;
          }

          // Extract metadata.
          ffmpeg.Metadata(newpath, function(data, err) {
            if (!err && !data.durationsec)
              err = new Error('No duration found.');

            if (err) {
              abort(err, null);
              return;
            }

            var title = data.title || shortname;
            var album = data.album;
            var artist = data.artist;
            var duration = data.durationsec;
            
            var song = new song_model.Song({
              title: data.title || shortname,
              album: data.album,
              artist: data.artist,
              duration: data.durationsec,
              timeUploaded: now
            }); 

            song.save(function(err) {
              
            });

            callback(null, null);
          });
        });
    });
};

