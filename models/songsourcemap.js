/* songsourcemap.js
 * Model representing a search result from a song source already existing in
 * the system as an existing Song entity.
 *
 * This model either maps possible duplications, or the source the Song
 * was actually downloaded from.
 */

exports.Model = null;
exports.name = 'SongSourceMap';

exports.define = function(sequelize, DataTypes) {
  exports.Model = sequelize.define(exports.name, {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sourceId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    confirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    original: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    classMethods: {
      associate: function(models) {
        this.belongsTo(models.Song);
      }
    }
  });

  return exports.Model;
};

