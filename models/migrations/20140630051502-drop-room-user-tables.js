/* Migration to drop old room and user tables. */
/*jshint es5: true */

var Q = require('q');

function populateOldRooms(migration) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize.models.RoomAdmin.findAll().then(function(rooms) {
    rooms.forEach(function(room) {
      sequelize.query(
        'INSERT INTO room (id, shortname, name, slots, timeCreated) ' +
        'VALUES(?, ?, ?, ?, ?)',
        null, { raw: true },
        [room.id, room.shortname, room.name, room.slots, room.createdAt]);
    });

    deferred.resolve();
  });

  return deferred.promise;
}

function populateOldRoomAdmins(migration, done) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize.models.RoomAdmin.findAll().then(function(roomAdmins) {
    roomAdmins.forEach(function(roomAdmin) {
      sequelize.query(
        'UPDATE room SET admin_id=? WHERE id=?',
        null, { raw: true }, [roomAdmin.UserId, roomAdmin.RoomId]);
    });

    deferred.resolve();
  });

  return deferred.promise;
}

function populateOldUsers(migration, done) {
  var deferred = Q.defer(),
      sequelize = migration.migrator.sequelize;

  sequelize.models.User.findAll().then(function(users) {
    users.forEach(function(user) {
      sequelize.query(
        'INSERT INTO user (id, username, firstName, lastName, fullName, ' +
        'admin, firstVisit, lastVisit) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        null, { raw: true },
        [ user.id, user.username, user.firstName, user.lastName,
          user.fullName, user.admin ? 1 : 0, user.createdAt,
          user.lastVisitAt ]);
    });

    deferred.resolve();
  });

  return deferred.promise;
}

module.exports = {
  up: function(migration, DataTypes, done) {
    migration.showAllTables().then(function(tables) {
      if (tables.indexOf('user') >= 0) {
        migration.dropTable('user');
      }
      if (tables.indexOf('room') >= 0) {
        migration.dropTable('room');
      }
    }).done(done);
  },

  down: function(migration, DataTypes, done) {
    // Recreate old room table.
    migration.createTable('room', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      shortname: {
        type: DataTypes.STRING
      },
      name: {
        type: DataTypes.STRING
      },
      slots: {
        type: DataTypes.INTEGER,
        defaultValue: 5
      },
      timeCreated: {
        type: DataTypes.DATE,
        allowNull: false
      },
      admin_id: {
        type: DataTypes.INTEGER
      }
    });

    // Recreate old user table.
    migration.createTable('user', {
      id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },
      firstName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      lastName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      fullName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      admin: {
        type: DataTypes.INTEGER(1),
        defaultValue: 0,
        allowNull: false
      },
      firstVisit: {
        type: DataTypes.DATE,
        allowNull: false
      },
      lastVisit: {
        type: DataTypes.DATE,
        allowNull: false
      }
    });

    // Populate old tables.
    populateOldRooms(migration)
    .then(function() {
      return populateOldRoomAdmins(migration);
    })
    .then(function() {
      return populateOldUsers(migration);
    })
    .then(done);
  }
};

