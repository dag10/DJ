/* fs.js
 * Wrappers for filesystem functions for logging.
 */

var fs = require('fs');
var os = require('os');
var winston = require('winston');
var Q = require('q');
var crypto = require('crypto');

var tmpDirId = Math.round(Math.random() * 100000);

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

/**
 * Creates a unique temporary directory.
 *
 * @return Path to unique directory.
 */
exports.createTmpDir = function() {
  var dir = os.tmpDir();
  if (dir[dir.length - 1] !== '/') dir += '/';

  dir += 'cshdj/';
  try {
    fs.mkdirSync(dir);
  } catch (e) {}

  var prehash = new Date().valueOf() + '-' + tmpDirId++;
  var hash = crypto.createHash('md5').update(prehash).digest('hex');

  dir += hash;
  fs.mkdirSync(dir);

  return dir;
};

