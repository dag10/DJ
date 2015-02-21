/* songstatistic.js
 * Song statistic model. Keeps record of plays, skips, up/down votes on songs,
 * and song adds.
 */
/*jshint es5: true */

exports.Model = null;
exports.name = 'SongStatistic';

exports.define = function(sequelize, DataTypes) {
  exports.Model = sequelize.define(exports.name, {
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
  },
  {
    classMethods: {
      associate: function(models) {
        this.belongsTo(models.User, {
          as: 'User'
        });
        this.belongsTo(models.Song, {
          as: 'Song'
        });
      }
    },
    getterMethods: {
      logNameTitle: function() { return this.title; }
    }
  });

  return exports.Model;
};

