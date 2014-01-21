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
    duration: {
      type: 'number', required: true },
    timeUploaded: {
      type: 'date', required: true }
  }, {
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
      }
    }
  });

  exports.Song = models.song = Song;
};

exports.associate = function(models) {
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

