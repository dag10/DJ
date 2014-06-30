/* Migration to create user table. */

module.exports = {
  up: function(migration, DataTypes, done) {
    var sequelize = migration.migrator.sequelize;

    // Create table.
    migration.createTable('users', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      username: {
        type: DataTypes.STRING,
        unique: true
      },
      firstName: {
        type: DataTypes.STRING
      },
      lastName: {
        type: DataTypes.STRING
      },
      fullName: {
        type: DataTypes.STRING
      },
      admin: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      lastVisitedAt: {
        type: DataTypes.DATE,
        allowNull: false
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

    // Migrate existing users from old user table.
    sequelize.query('SELECT * FROM user').success(function(users) {
      users.forEach(function(user) {
        sequelize.models.User.create({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          admin: user.admin === 1,
          lastVisitedAt: user.lastVisit
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

