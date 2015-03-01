/* user.js
 * User model.
 */

var config = require('../config');
var secret = Math.random() + config.web.secret;
var crypto = require('crypto');

exports.Model = null;
exports.name = 'User';

exports.define = function(sequelize, DataTypes) {
  exports.Model = sequelize.define(exports.name, {
    username: {
      type: DataTypes.STRING,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    firstName: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true
      }
    },
    lastName: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true
      }
    },
    fullName: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true
      }
    },
    admin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      validate: {
        notEmpty: true
      }
    },
    lastVisitedAt: {
      type: DataTypes.DATE
    }
  }, {
    classMethods: {
      associate: function(models) {
        this.hasMany(models.Room, {
          as: 'Rooms',
          through: models.RoomAdmin
        });
        this.hasMany(models.Song, {
          foreignKey: 'UploaderId',
          as: 'UploadedSongs',
          through: null
        });
        this.hasMany(models.Song, {
          as: 'Queueings',
          through: models.QueuedSong
        });
        this.hasMany(models.SongStatistic, {
          as: 'SongStatistics'
        });
      },
      hashUsername: function(username) {
        return crypto.createHash('sha1')
          .update(username + '_' + secret)
          .digest('hex');
      }
    },
    hooks: {
      // When a user is deleted, delete its queueings.
      beforeDestroy: function(user, fn) {
        models.QueuedSong.destroy({
          UserId: user.id
        }).done(fn);
      }
    },
    instanceMethods: {
      hash: function() {
        return this.Model.hashUsername(this.username);
      }
    },
    getterMethods: {
      logNameId: function() { return this.username; },
      logNameTitle: function() { return this.fullName; }
    }
  });

  return exports.Model;
};

