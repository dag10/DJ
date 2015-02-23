/* Migration to create song statistic table. */
/*jshint es5: true */

var Q = require('q');

module.exports = {
  up: function(migration, DataTypes, done) {
    migration.createTable('SongStatistics', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      event: {
        type: DataTypes.ENUM,
        allowNull: false,
        values: [
          'play',
          'upvote',
          'downvote',
          'enqueue',
          'skip',
          'voteskip',
        ],
      },
      UserId: {
        type: DataTypes.INTEGER,
      },
      SongId: {
        type: DataTypes.INTEGER,
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

    done();
  },

  down: function(migration, DataTypes, done) {
    done(new Error('Downwards migration not implemented.'));
  }
};

