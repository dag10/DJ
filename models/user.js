/* user.js
 * User model.
 */

exports.define = function(db, models) {
  var User = db.define('user', {
    username: {
      type: 'text', required: true, unique: true },
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
  });

  models.user = User;

  User.sync(function() {
    console.info('User table created.');
  });
};

