/* Migration to seed two default rooms. */
/*jshint es5: true */

var Q = require('q');

/**
 * Seeds a room if a room by its shortname doesn't already exist.
 *
 * @param sequelize The sequelize instance.
 * @param name The full name for the room. Shortname is automatically made.
 * @param slots The number of slots for the room.
 * @return A promise resolving if the operation was successful or skipped.
 */
function seedRoom(sequelize, name, slots) {
  var deferred = Q.defer();

  var newRoom = sequelize.models.Room.build({
    name: name,
    slots: slots
  });

  sequelize
    .query(
      'SELECT * FROM Rooms WHERE shortname=?',
      null, { raw: true }, [newRoom.shortname])
    .success(function(rooms) {
      if (rooms.length > 0) {
        deferred.resolve();
        return;
      }

      newRoom.save().success(deferred.resolve).error(deferred.reject);
    }).error(deferred.reject);

  return deferred.promise;
}

module.exports = {
  up: function(migration, DataTypes, done) {
    var sequelize = migration.migrator.sequelize;

    Q.all([
      seedRoom(sequelize, 'Lounge', 5),
      seedRoom(sequelize, 'Project Room', 2),
    ]).done(function() {
      done();
    });
  },
  down: function(migration, DataTypes, done) {
    // nothing
    done();
  }
};
