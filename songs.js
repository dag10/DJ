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
  return name.toLowerCase()
      .replace(/[\s_\-]+/g, '-')
      .replace(/[^\w\-\.]/g, '');
};

var filenameOfPath = function(path) {
  return path.replace(/^.*[\\\/]/, '');
};

var removeExtension = function(file) {
  return file.replace(/\.[^\.]*$/, '');
};

var changeExtension = function(file, extension) {
  return removeExtension(file) + '.' + extension;
};

exports.addSong = function(path, user, name, callback) {
  if (!fs.existsSync(path)) {
    var err = new Error('Song path does not exist.');
    winston.error(err.message);
    callback(err);
    return;
  }

  var now = new Date();

  var shortname = generateShortName(removeExtension(name));
  var newpath = upload.song_dir + '/' + changeExtension(shortname, 'mp3');
  var screenshots = [];

  var song, song_file, artwork_file;

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
    if (song) {
      var songid = song.id;
      song.remove(function(err) {
        if (err)
          winston.error('Failed to delete song entity: ' + err.message);
        else
          winston.info('Abort; Deleted song entity: ' + songid);
      });
    }
    if (song_file) {
      var song_fileid = song_file.id;
      song_file.remove(function(err) {
        if (err)
          winston.error('Failed to delete song file entity: ' + err.message);
        else
          winston.info('Abort; Deleted song file entity: ' + song_fileid);
      });
    }
    if (artwork_file) {
      var artwork_fileid = artwork_file.id;
      artwork_file.remove(function(err) {
        if (err)
          winston.error(
              'Failed to delete artwork file entity: ' + err.message);
        else
          winston.info(
              'Abort; Deleted artwork file entity: ' + artwork_fileid);
      });
    }
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
            
            song = new song_model.Song({
              title: data.title || shortname,
              album: data.album,
              artist: data.artist,
              duration: data.durationsec,
              timeUploaded: now,
              uploader: user
            }); 

            song.save(function(err) {
              if (err) {
                abort(err, null);
                return;
              }

              var base = song.id + '-' + generateShortName(song.title);
              var oldnewpath = newpath;
              var songfilename = changeExtension(base, 'mp3');
              newpath = upload.song_dir + '/' + songfilename;
              fs.renameSync(oldnewpath, newpath); 

              song_file = new file_model.File({
                directory: upload.song_path,
                filename: songfilename,
                timeUploaded: now,
                uploader: user
              });

              song_file.save(function(err) {
                if (err) {
                  abort(err, null);
                  return;
                }

                song.file = song_file;

                var next = function() {
                  song.save(function(err) {
                    if (err) {
                      abort(err, null);
                      return;
                    }

                    if (user)
                      winston.info(
                        user.getLogName() + ' uploaded ' + song.getLogName());
                    else
                      winston.info('Song added: ' + song.getLogName());

                    callback(song, null);
                  });
                };

                if (screenshots.length > 0) {
                  var oldimage = screenshots[0];
                  screenshots[0] = changeExtension(base, 'jpg');
                  fs.renameSync(
                      upload.artwork_dir + '/' + oldimage,
                      upload.artwork_dir + '/' + screenshots[0]);

                  artwork_file = new file_model.File({
                    directory: upload.artwork_path,
                    filename: screenshots[0],
                    timeUploaded: now,
                    uploader: user
                  });

                  artwork_file.save(function(err) {
                    if (err) {
                      abort(err, null);
                      return;
                    }

                    song.artwork = artwork_file;
                    next();
                  });
                } else {
                  next();
                }
              });
            });
          });
        });
    });
};

