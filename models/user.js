/* user.js
 * User model.
 */

var config = require('../config');
var secret = config.web.secret + '_hash';
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
      hashUsername: function(username) {
        return crypto.createHash('sha1')
          .update(username + '_' + secret)
          .digest('hex');
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

