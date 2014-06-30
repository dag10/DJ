/* Migration to create Room table. */

module.exports = {
  up: function(migration, DataTypes, done) {
    var sequelize = migration.migrator.sequelize;

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

    // Migrate existing rooms from old room table.
    sequelize.query('SELECT * FROM room').success(function(rooms) {
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
    }).done(done);
  },

  down: function(migration, DataTypes, done) {
    // nothing
  }
};

