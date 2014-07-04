/* Migration to fix table name cases. */

module.exports = {
  up: function(migration, DataTypes, done) {
    migration.renameTable('rooms', 'Rooms');
    migration.renameTable('users', 'Users');
    migration.renameTable('roomadmins', 'RoomAdmins');
    done();
  },
  down: function(migration, DataTypes, done) {
    migration.renameTable('Rooms', 'rooms');
    migration.renameTable('Users', 'users');
    migration.renameTable('RoomAdmins', 'roomadmins');
    done();
  }
};

