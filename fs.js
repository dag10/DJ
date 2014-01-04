/* fs.js
 * Wrappers for filesystem functions for logging.
 */

var fs = require('fs');
var winston = require('winston');

exports.unlink = function(path) {
  fs.unlink(path, function(err) {
    if (err)
      winston.error('Failed to delete "' + path + '": ' + err.message);
    else
      winston.info('Deleted file: ' + path);
  });
};

