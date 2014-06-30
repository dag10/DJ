/* roomadmin.js
 * Model mapping rooms to admins.
 */

exports.Model = null;
exports.name = 'RoomAdmin';

exports.define = function(sequelize, DataTypes) {
  exports.Model = sequelize.define(exports.name, {});
  return exports.Model;
};

