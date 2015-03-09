/* song.js
 * Song model.
 */

var queued_song_model = require('./queuedsong');

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
        this.belongsToMany(models.User, {
          as: 'Queueings',
          through: models.QueuedSong
        });
        this.hasMany(models.SongSourceMap, {
          as: 'SourceMappings'
        });
      }
    },
    hooks: {
      // When a song is deleted, delete its queueings.
      beforeDestroy: function(song, fn) {
        queued_song_model.Model.destroy({
          where: {
            SongId: song.id
          }
        }).done(fn);
      }
    },
    getterMethods: {
      logNameTitle: function() { return this.title; }
    }
  });

  return exports.Model;
};

