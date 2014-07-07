/* Migration to create user table. */
/*jshint es5: true */

var Q = require('q');

module.exports = {
  up: function(migration, DataTypes, done) {
    var sequelize = migration.migrator.sequelize,
        deferred = Q.defer();
    
    deferred.promise.done(done);

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
    sequelize.query('SHOW TABLES LIKE "user"').success(function(tables) {
      if (tables.length === 0) {
        deferred.resolve();
        return true;
      }

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
      }).done(deferred.resolve);
    }).error(deferred.resolve);
  },

  down: function(migration, DataTypes, done) {
    done(new Error('Downwards migration not implemented.'));
  }
};

