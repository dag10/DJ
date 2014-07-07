/* logging.js
 * Utility functions for logging.
 */

var config = require('../config');
var winston = require('winston');
var fs = require('fs');
var Q = require('q');

var log_dir = config.log_directory;

exports.init = function() {
  var deferred = Q.defer();

  // Enable colors and timestamps in console logging.
  winston.remove(winston.transports.Console);
  winston.add(winston.transports.Console, {
    handleExceptions: !config.debug,
    level: config.debug ? 'debug' : 'info',
    colorize: true,
    timestamp: true
  });

  // Ensure log directory exists.
  if (!fs.existsSync(log_dir)) {
    fs.mkdir(log_dir);
    winston.info('Created directory: ' + log_dir);
  }

  // Figure out what the next available log filename is.
  var now = new Date();
  var i = 0;
  var filename;
  do {
    filename = (
      log_dir + '/' + now.getFullYear() + '-' + (now.getMonth() + 1) + '-' +
      now.getDate() + (i > 0 ? ('.'+i) : '') + '.json');
    i++;
  } while (fs.existsSync(filename));

  winston.info('Logging to ' + filename);

  // Enable file logging.
  winston.add(winston.transports.File, {
    handleExceptions: !config.debug,
    level: 'debug',
    filename: filename
  });

  deferred.resolve();
  return deferred.promise;
};

