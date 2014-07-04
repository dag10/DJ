/* Migration to create RoomAdmin table. */
/*jshint es5: true */

var Q = require('q');

module.exports = {
  up: function(migration, DataTypes, done) {
    var sequelize = migration.migrator.sequelize,
        deferred = Q.defer();

    deferred.promise.done(done);

    // Create table.
    migration.createTable('roomadmins', {
      UserId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      RoomId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Migrate existing room admin settings from old room table.
    sequelize.query('SHOW TABLES LIKE "room"').success(function(tables) {
      if (tables.length === 0) {
        deferred.resolve();
        return;
      }

      sequelize.query('SELECT * FROM room').success(function(rooms) {
        rooms.forEach(function(room) {
          if (room.admin_id) {
            sequelize.models.RoomAdmin.create({
              UserId: room.admin_id,
              RoomId: room.id
            }, {
              raw: true
            });
          }
        });
      }).done(deferred.resolve);
    }).error(deferred.resolve);
  },

  down: function(migration, DataTypes, done) {
    // nothing
  }
};

