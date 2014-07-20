/* Create SongSourceMaps for existing uploaded songs. */
/*jshint es5: true */

var Q = require('q');

exports.up = function(migration, DataTypes, done) {
  var sequelize = migration.migrator.sequelize;

  sequelize
  .query('SELECT * FROM Songs')
  .then(function(songs) {
    var ops = [];
    songs.forEach(function(song) {
      ops.push(sequelize.query(
        'INSERT INTO SongSourceMaps ' +
        '(source, sourceId, confirmations, original, createdAt, updatedAt, ' +
        'SongId) ' +
        'VALUES ' +
        '(:source, :sourceId, :confirmations, :original, :createdAt, ' +
        ':updatedAt, :SongId)',
        null, { raw: true }, {
          source: 'upload',
          sourceId: song.id,
          confirmations: 0,
          original: true,
          createdAt: song.createdAt,
          updatedAt: song.createdAt,
          SongId: song.id,
        }
      ));
    });
    if (ops.length > 0) {
      Q.all(ops).done(function() {
        done();
      });
    } else {
      done();
    }
  }).catch(done);
};

exports.down = function(migration, DataTypes, done) {
  done(); // nothing
};

