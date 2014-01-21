/* queued_song.js
 * Model representing a song in a user's queue.
 */

var orm = require('orm');

var QueuedSong;

exports.define = function(db, models) {
  QueuedSong = db.define('queued_song', {
    order: {
      type: 'number', defaultValue: 0 }
  });

  exports.QueuedSong = models.queued_song = QueuedSong;
};

exports.associate = function(models) {
  QueuedSong.hasOne('user', models.user, {
    reverse: 'queuedSongs'
  });
  QueuedSong.hasOne('song', models.song, {
    reverse: 'queueings', autoFetch: true
    // I would put required here, but a node-orm2 bug then prevents intuitive
    // setting of the song due to a validation error.
  });
};

