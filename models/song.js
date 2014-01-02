/* song.js
 * Song model.
 */

var orm = require('orm');

var Song;

exports.define = function(db, models) {
  Song = db.define('song', {
    title: {
      type: 'text', required: true },
    artist: {
      type: 'text' },
    album: {
      type: 'text' },
    runtime: {
      type: 'number', required: true },
    timeUploaded: {
      type: 'date', required: true }
  }, {
    validations: {
      name: orm.enforce.unique({ ignoreCase: true })
    }
  });

  models.song = Song;
};

exports.associate = function(models) {
  Song.hasOne('uploader', models.person, {
    reverse: 'songs'
  });
  Song.hasOne('original_file', models.file);
  Song.hasOne('converted_file', models.file, {
    autoFetch: true, required: true
  });
  Song.hasOne('artwork', models.file, {
    autoFetch: true
  });
};

