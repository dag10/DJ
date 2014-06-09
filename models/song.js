/* song.js
 * Song model.
 */

var orm = require('orm');
var migration_utils = require('../utils/migration_utils.js');

var Song;

exports.define = function(db, models) {
  Song = db.define('song', {
    source: {
      type: 'text', size: 20, required: true },
    uuid: {
      type: 'text', size: 40, required: true },
    title: {
      type: 'text', required: true },
    artist: {
      type: 'text' },
    album: {
      type: 'text' },
    duration: {
      type: 'number', required: true },
    timeUploaded: {
      type: 'date', required: true }
  }, {
    validations: {
      uuid: orm.enforce.unique({ ignoreCase: true })
    },
    methods: {
      getLogName: function() {
        return this.title + ' (' + this.id + ')';
      }
    },
    hooks: {
      beforeRemove: function() {
        if (this.file)
          this.file.remove();
        if (this.artwork)
          this.artwork.remove();
        this.getQueueings(function(err, queued_songs) {
          queued_songs.forEach(function(queued_song) {
            queued_song.remove();
          });
        });
      }
    }
  });

  exports.Song = models.song = Song;
};

exports.associate = function(models) {
  Song.associations = ['uploader', 'file', 'artwork'];
  Song.hasOne('uploader', models.person, {
    reverse: 'songs'
  });
  Song.hasOne('file', models.file, {
    autoFetch: true
  });
  Song.hasOne('artwork', models.file, {
    autoFetch: true
  });
};

exports.migrate = function(migrate, db) {
  // Add source field and uuid fields.
  // Source defaults to "upload" since that's all we've had up till this point.
  // UUID defaults to the sha1 hash of "upload:<id>".
  migrate('add source and uuid', function(next) {
    migration_utils.runQueries([
      'ALTER TABLE song ADD source VARCHAR(20) NOT NULL FIRST',
      'ALTER TABLE song ADD uuid VARCHAR(40) NOT NULL AFTER source',
      'UPDATE song SET source=\'upload\'',
      'UPDATE song SET uuid=SHA1(CONCAT(source, \':\', id))'
    ], db, 'song', next);
  }, function(next) {
    migration_utils.runQueries([
      'ALTER TABLE song DROP source',
      'ALTER TABLE song DROP uuid'
    ], db, 'song', next);
  });
};

