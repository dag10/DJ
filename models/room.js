/* room.js
 * Room model.
 */

exports.Model = null;
exports.name = 'Room';

exports.define = function(sequelize, DataTypes) {
  exports.Model = sequelize.define(exports.name, {
    shortname: {
      type: DataTypes.STRING,
      unique: true,
      validate: {
        notEmpty: true
      }
    },
    name: {
      type: DataTypes.STRING,
      validate: {
        notEmpty: true
      },
      set: function(name) {
        this.setDataValue('name', name);
        this.setDataValue(
          'shortname', exports.Model.generateShortName(name));
      }
    },
    slots: {
      type: DataTypes.INTEGER,
      defaultValue: 5
    }
  }, {
    classMethods: {
      associate: function(models) {
        this.belongsToMany(models.User, {
          as: 'Admins',
          through: models.RoomAdmin
        });
      },
      generateShortName: function(name) {
        return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
      }
    },
    getterMethods: {
      logNameId: function() { return this.shortname; },
      logNameTitle: function() { return this.name; }
    }
  });

  return exports.Model;
};

