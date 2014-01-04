/* songs.js
 * Manages songs.
 */

var winston = require('winston');
var config = require('./config');
var fs = require('fs');
var upload = require('./upload');
var exif = require('exif2');
var ffmpeg = require('ffmpeg-node');

var generateShortName = function(name) {
  return name.toLowerCase().replace(/[\s\-]+/g, '-').replace(/[^\w\-\.]/g, '');
};

exports.addSong = function(path, user, callback) {
  if (!fs.existsSync(path)) {
    var err = new Error('Song path does not exist.');
    winston.error(err);
    callback(err);
    return;
  }

  var filename = path.replace(/^.*[\\\/]/, '');
  var shortname = generateShortName(filename);
  var namebase = shortname.replace(/\.[^\.]*$/, '');
  var newpath = upload.song_dir + '/' + namebase + '.mp3';

  // TODO: Get this to convert to a 320kbps mp3. It currently seems to be
  //       doing 128kbps or 56 kbps which is weird.
  var args = ['-ab', '320k', '-map_metadata', '0', '-i', path, newpath];

  ffmpeg.exec(args, function(stderr, stdout, code) {
    if (code !== 0) {
      winston.error(new Error('ffmpeg returned ' + code + ':\n' + stderr));
      callback(null, new Error('ffmpeg returned ' + code));
      return;
    }

    exif(newpath, function(err, data) {
      console.log('EXIF:', data);

      // TODO: data contains exif data -- including the artwork!
      //       Parse it, put it in a db, and extract+save the artwork.
      //       Goddammit, go to bed. It's 5:00 am.
      callback(null, null);
    });
  });
};

