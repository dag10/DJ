/* auth/index.js
 * Module for managing authentication schemes.
 */
/*jshint es5: true */

var config = require('../../config.js');
var Q = require('q');

/**
 * Map of method names to method modules.
 */
var methods = {
  'dev': './dev',
};

/** Loaded auth module. */
var auth_module;

/**
 * Initializes authentication model as specified in the config.
 *
 * @return Promise resolving when initialization is complete.
 */
exports.init = function() {
  var method = config.auth.method;

  if (!method) {
    return Q.reject(new Error(
      'No authentication method specified in config.'));
  }

  if (!methods[method]) {
    return Q.reject(new Error(
      'Authentication method "' + method + '" not valid.'));
  }

  auth_module = require(methods[method]);
  return auth_module.init();
};



