/* user.js
 * User model.
 */

var orm = require('orm');
var crypto = require('crypto');

var secret = Math.random() + '_hash';
var User;

exports.hashUser = function(username) {
  return crypto.createHash('sha1')
    .update(username + '_' + secret)
    .digest('hex');
};

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
    },
    methods: {
      getLogName: function() {
        return this.fullName + ' (' + this.username + ')';
      },
      hash: function() {
        return exports.hashUser(this.username);
      }
    }
  });

  exports.User = models.user = User;
};

