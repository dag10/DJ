/* song.js
 * Song model.
 */

exports.Model = null;
exports.name = 'Song';

exports.define = function(sequelize, DataTypes) {
  exports.Model = sequelize.define(exports.name, {
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    artist: {
      type: DataTypes.STRING
    },
    album: {
      type: DataTypes.STRING
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  },
  {
    classMethods: {
      associate: function(models) {
        this.belongsTo(models.User, {
          foreignKey: 'UploaderId',
          as: 'Uploader'
        });
        this.belongsTo(models.File, {
          as: 'File',
          onDelete: 'cascade',
          hooks: true
        });
        this.belongsTo(models.File, {
          as: 'Artwork',
          onDelete: 'cascade',
          hooks: true
        });
        this.hasMany(models.User, {
          as: 'Queueings',
          through: models.QueuedSong
        });
        this.hasMany(models.SongSourceMap, {
          as: 'SourceMappings'
        });

        // When a song is delete, delete its queueings.
        this.beforeDestroy(function(song, fn) {
          models.QueuedSong.destroy({
            SongId: song.id
          }).done(fn);
        });
      }
    },
    getterMethods: {
      logNameTitle: function() { return this.title; }
    }
  });

  return exports.Model;
};

