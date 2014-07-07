/* file.js
 * File model. Represents a file stored locally.
 */

/*jshint es5: true */

var _fs = require('../utils/fs');
var config = require('../config.js');

exports.Model = null;
exports.name = 'File';

exports.define = function(sequelize, DataTypes) {
  exports.Model = sequelize.define(exports.name, {
    directory: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  {
    classMethods: {
      associate: function(models) {
        this.belongsTo(models.User, {
          as: 'Uploader'
        });

        // When a user is delete, delete their queueings.
        this.beforeDestroy(function(user, fn) {
          models.QueuedSong.destroy({
            UserId: user.id
          }).done(fn);
        });
      }
    },
    getterMethods: {
      path: function() {
        return this.directory + '/' + this.filename;
      },
      fullpath: function() {
        return config.uploads_directory + '/' + this.path;
      },
      logNameTitle: function() { return this.path; }
    }
  });

  // Delete the file on the filesystem when the model is destroyed.
  exports.Model.beforeDestroy(function(instance, fn) {
    _fs.unlink(instance.fullpath).then(fn).catch(fn).done();
  });

  return exports.Model;
};

