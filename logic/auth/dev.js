/* auth/dev.js
 * Development authentication method.
 */
/*jshint es5: true */

var Q = require('q');
var config = require('../../config.js');

/**
 * Initializes dev auth method.
 *
 * @return Promise resolving when initialized.
 */
exports.init = function() {
  return Q.reject(new Error('Dev auth not implemented!!'));
};

