/* fs.js
 * Wrappers for filesystem functions for logging.
 */

var fs = require('fs');
var winston = require('winston');
var Q = require('q');

exports.unlink = function(path, canFail) {
  var deferred = Q.defer();

  fs.unlink(path, function(err) {
    if (err && !canFail) {
      winston.error(
        'Failed to delete "' + path + '": ' + err.message + '\n' + err.stack);
      deferred.reject(err);
    } else if (!err) {
      winston.info('Deleted file: ' + path);
      deferred.resolve();
    } else {
      deferred.resolve();
    }
  });

  return deferred.promise;
};

exports.exists = function(path) {
  var deferred = Q.defer();
  fs.exists(path, deferred.resolve);
  return deferred.promise;
};

