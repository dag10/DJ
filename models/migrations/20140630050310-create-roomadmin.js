/* Migration to create RoomAdmin table. */

module.exports = {
  up: function(migration, DataTypes, done) {
    var sequelize = migration.migrator.sequelize;

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
    }).done(done);
  },

  down: function(migration, DataTypes, done) {
    // nothing
  }
};

