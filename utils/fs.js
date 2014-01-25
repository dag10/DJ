/* fs.js
 * Wrappers for filesystem functions for logging.
 */

var fs = require('fs');
var winston = require('winston');

exports.unlink = function(path, canFail) {
  fs.unlink(path, function(err) {
    if (err && !canFail)
      winston.error('Failed to delete "' + path + '": ' + err.message);
    else if (!err)
      winston.info('Deleted file: ' + path);
  });
};

