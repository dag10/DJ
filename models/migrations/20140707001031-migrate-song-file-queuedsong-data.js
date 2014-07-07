/* Migrate Song, QueuedSong, and File table data. */
/*jshint es5: true */

var Q = require('q');
var Sequelize = require('sequelize');

/**
 * Migrate old file table to new Files table.
 *
 * @param migration Sequelize migration object.
 * @return Promise resolving for this operation.
 */
function migrateToNewFiles(migration) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;
  
  sequelize
  .query('SELECT * FROM file')
  .then(function(files) {
    var ops = [];
    files.forEach(function(file) {
      ops.push(sequelize.query(
        'INSERT INTO Files ' +
        '(id, directory, filename, createdAt, updatedAt, UploaderId) ' +
        'VALUES ' +
        '(:id, :directory, :filename, :createdAt, :updatedAt, :UploaderId)',
        null, { raw: true }, {
          id: file.id,
          directory: file.directory,
          filename: file.filename,
          createdAt: file.timeUploaded,
          updatedAt: file.timeUploaded,
          UploaderId: file.uploader_id,
        }
      ));
    });
    if (ops.length > 0) {
      Q.all(ops).done(deferred.resolve);
    } else {
      deferred.resolve();
    }
  }).catch(deferred.reject);

  return deferred.promise;
}

/**
 * Migrate old song table to new Songs table.
 *
 * @param migration Sequelize migration object.
 * @return Promise resolving for this operation.
 */
function migrateToNewSongs(migration) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize
  .query('SELECT * FROM song')
  .then(function(songs) {
    var ops = [];
    songs.forEach(function(song) {
      ops.push(sequelize.query(
        'INSERT INTO Songs ' +
        '(id, title, artist, album, duration, createdAt, updatedAt, ' +
        'UploaderId, FileId, ArtworkId) ' +
        'VALUES ' +
        '(:id, :title, :artist, :album, :duration, :createdAt, :updatedAt, ' +
        ':UploaderId, :FileId, :ArtworkId)',
        null, { raw: true }, {
          id: song.id,
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          createdAt: song.timeUploaded,
          updatedAt: song.timeUploaded,
          UploaderId: song.uploader_id,
          FileId: song.file_id,
          ArtworkId: song.artwork_id,
        }
      ));
    });
    if (ops.length > 0) {
      Q.all(ops).done(deferred.resolve);
    } else {
      deferred.resolve();
    }
  }).catch(deferred.reject);

  return deferred.promise;
}

/**
 * Migrate old queued_song table to new QueuedSongs table.
 *
 * @param migration Sequelize migration object.
 * @return Promise resolving for this operation.
 */
function migrateToNewQueuedSongs(migration) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize
  .query('SELECT * FROM queued_song')
  .then(function(queueings) {
    var now = new Date();
    var ops = [];
    queueings.forEach(function(queueing) {
      ops.push(sequelize.query(
        'INSERT INTO QueuedSongs ' +
        '(id, `order`, createdAt, updatedAt, UserId, SongId) ' +
        'VALUES ' +
        '(:id, :order, :createdAt, :updatedAt, :UserId, :SongId)',
        null, { raw: true }, {
          id: queueing.id,
          order: queueing.order,
          createdAt: now,
          updatedAt: now,
          UserId: queueing.user_id,
          SongId: queueing.song_id,
        }
      ));
    });
    if (ops.length > 0) {
      Q.all(ops).done(deferred.resolve);
    } else {
      deferred.resolve();
    }
  }).catch(deferred.reject);

  return deferred.promise;
}

exports.up = function(migration, DataTypes, done) {
  Q.all([
    migrateToNewFiles(migration),
    migrateToNewSongs(migration),
    migrateToNewQueuedSongs(migration),
  ]).then(function() {
    done();
  }).catch(done);
};

/**
 * Migrate new Files table to old file table.
 *
 * @param migration Sequelize migration object.
 * @return Promise resolving for this operation.
 */
function migrateToOldFiles(migration) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize
  .query('SELECT * FROM Files')
  .then(function(files) {
    var ops = [];
    files.forEach(function(file) {
      ops.push(sequelize.query(
        'INSERT INTO file ' +
        '(id, directory, filename, timeUploaded, uploader_id) ' +
        'VALUES ' +
        '(:id, :directory, :filename, :timeUploaded, :uploader_id)',
        null, { raw: true }, {
          id: file.id,
          directory: file.directory,
          filename: file.filename,
          timeUploaded: file.createdAt,
          uploader_id: file.UploaderId,
        }
      ));
    });
    if (ops.length > 0) {
      Q.all(ops).done(deferred.resolve);
    } else {
      deferred.resolve();
    }
  }).catch(deferred.reject);
  
  return deferred.promise;
}

/**
 * Migrate new Songs table to old song table.
 *
 * @param migration Sequelize migration object.
 * @return Promise resolving for this operation.
 */
function migrateToOldSongs(migration) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize
  .query('SELECT * FROM Songs')
  .then(function(songs) {
    var ops = [];
    songs.forEach(function(song) {
      ops.push(sequelize.query(
        'INSERT INTO song ' +
        '(id, source, uuid, title, artist, album, duration, timeUploaded, ' +
        'uploader_id, file_id, artwork_id) ' +
        'VALUES ' +
        '(:id, :source, SHA1(CONCAT(:source, \':\', :id)), :title, :artist, ' +
        ':album, :duration, :timeUploaded, :uploader_id, :file_id, ' +
        ':artwork_id)',
        null, { raw: true }, {
          id: song.id,
          source: 'upload',
          title: song.title,
          artist: song.artist,
          album: song.album,
          duration: song.duration,
          timeUploaded: song.createdAt,
          uploader_id: song.UploaderId,
          file_id: song.FileId,
          artwork_id: song.ArtworkId,
        }
      ));
    });
    if (ops.length > 0) {
      Q.all(ops).done(deferred.resolve);
    } else {
      deferred.resolve();
    }
  }).catch(deferred.reject);

  return deferred.promise;
}

/**
 * Migrate new QueuedSongs table to old queued_song table.
 *
 * @param migration Sequelize migration object.
 * @return Promise resolving for this operation.
 */
function migrateToOldQueuedSongs(migration) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize
  .query('SELECT * FROM QueuedSongs')
  .then(function(queueings) {
    var now = new Date();
    var ops = [];
    queueings.forEach(function(queueing) {
      ops.push(sequelize.query(
        'INSERT INTO queued_song ' +
        '(id, `order`, user_id, song_id) ' +
        'VALUES ' +
        '(:id, :order, :user_id, :song_id)',
        null, { raw: true }, {
          id: queueing.id,
          order: queueing.order,
          user_id: queueing.UserId,
          song_id: queueing.SongId,
        }
      ));
    });
    if (ops.length > 0) {
      Q.all(ops).done(deferred.resolve);
    } else {
      deferred.resolve();
    }
  }).catch(deferred.reject);

  return deferred.promise;
}

exports.down = function(migration, DataTypes, done) {
  Q.all([
    migrateToOldFiles(migration),
    migrateToOldSongs(migration),
    migrateToOldQueuedSongs(migration),
  ]).then(function() {
    done();
  }).catch(done);
};

