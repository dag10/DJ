/* Migration to create Room table. */
/*jshint es5: true */

var Q = require('q');

module.exports = {
  up: function(migration, DataTypes, done) {
    var sequelize = migration.migrator.sequelize,
        deferred = Q.defer();

    deferred.promise.done(done);

    // Migrate existing rooms from old room table.
    sequelize.query(
      'SHOW TABLES LIKE "room"',
      { type: sequelize.QueryTypes.SHOWTABLES }).then(function(tables) {

      // Create table.
      migration.createTable('rooms', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        shortname: {
          type: DataTypes.STRING,
          unique: true
        },
        name: {
          type: DataTypes.STRING
        },
        slots: {
          type: DataTypes.INTEGER,
          defaultValue: 5
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

      if (tables.length === 0 || tables[0].length === 0) {
        deferred.resolve();
        return;
      }

      sequelize.query(
        'SELECT * FROM room',
        { type: sequelize.QueryTypes.SELECT }).then(function(rooms) {
        rooms.forEach(function(room) {
          sequelize.models.Room.create({
            id: room.id,
            shortname: room.shortname,
            name: room.name,
            slots: room.slots
          }, {
            raw: true
          });
        });
      }).done(deferred.resolve);
    }).catch(deferred.resolve);
  },

  down: function(migration, DataTypes, done) {
    done(new Error('Downwards migration not implemented.'));
  }
};

