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
 * Loads and initializes authentication module specified in the config.
 *
 * Once the module is loaded, this auth module becomes that specific module.
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
  var promise = auth_module.init();

  promise.then(function() {
    Object.keys(auth_module).forEach(function(key) {
      module.exports[key] = auth_module[key];
    });
  });

  return promise;
};

/**
 * Defines web handlers.
 *
 * Auth modules should implement this if needed.
 *
 * @param express_app Express app object.
 * @param render Function to render a page.
 * @return Object containing keys login_url and logout_url.
 */
exports.createWebHandlers = function(express_app, render) {
  throw new Error('Auth module not loaded.');
};

/**
 * Gets the user object from an Express request session.
 *
 * @param req Express request object.
 * @param res Express response object.
 * @return Promise resolving with User object or null.
 */
exports.getSessionUser = function(req, res) {
  return Q.reject(new Error('Auth module not loaded.'));
};


