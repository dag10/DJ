/* user.js
 * User model.
 */

var orm = require('orm');

var User;

exports.define = function(db, models) {
  User = db.define('user', {
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
      type: 'date', required: true },
    lastVisit: {
      type: 'date', required: true }
  }, {
    validations: {
      username: orm.enforce.unique({ ignoreCase: true })
    }
  });

  exports.User = models.user = User;
};

