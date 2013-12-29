/* user.js
 * User model.
 */

var orm = require('orm');

exports.define = function(db, models) {
  var User = db.define('user', {
    username: {
      type: 'text', required: true },
    firstName: {
      type: 'text', required: true },
    lastName: {
      type: 'text', required: true },
    fullName: {
      type: 'text', required: true },

    admin: {
      type: 'boolean', required: true, defaultValue: false },

    firstVisit: {
      type: 'text', required: true },
    lastVisit: {
      type: 'text', required: true }
  }, {
    validations: {
      username: orm.enforce.unique({ ignoreCase: true })
    }
  });

  models.user = User;
};

