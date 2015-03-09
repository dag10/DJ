/* load_config.js
 * Loads config.js or outputs an error.
 */
/*jshint es5: true */

var colors = require('colors');
var fs = require('fs');
var winston = require('winston');

// Default values to assume for missing config keys.
var default_values = {
  log_directory: __dirname + '/logs',
  uploads_directory: __dirname + '/uploads',
  superadmin: 'dag10',
  debug: true,
  debug_socketio: false,
  playback_gap: 1,
  max_duration: 10,
  transcoding: {
    max_concurrent_jobs: 2,
  },
  web: {
    host: '0.0.0.0',
    port: process.env.PORT || 9867,
    debug: true,
    title: 'CSH DJ',
    secret: 'change me!',
    compress_css: true,
    max_file_size: 50,
  },
  auth: {
    method: 'dev',
    ldap: {
      strictFullName: true,
      baseURL: 'ldap://ldap.csh.rit.edu',
      dnBase: 'ou=Users,dc=csh,dc=rit,dc=edu',
      dnFormat: 'uid=%username%,ou=Users,dc=csh,dc=rit,dc=edu',
      filter: '(&(objectclass=houseMember)(uid=%username%))',
      attributes: {
        firstName: 'givenName',
        lastName: 'sn',
        fullName: 'cn',
      },
    },
  },
  db: {
    host: 'localhost',
    username: 'user',
    password: 'pass',
    database: 'dj',
  },
  song_sources: {
    external_modules: [],
    configurations: {},
    results_format: {
      upload: 6,
    },
  },
};

// Make sure config exists.
if (!fs.existsSync('./config.js')) {
  console.error(
    'Config file not found. Copy ' + 'config.example.js'.bold.green +
    ' to ' + 'config.js'.bold.green + ' and edit it as needed.');
  module.exports = null;
}

// Become the config. Whoa, that's deep.
module.exports = require('../config');
module.exports.warnings = [];

/**
 * Returns a string describing the value type.
 * Values: 'object', 'array', 'value', 'null'
 *
 * @param value Variable to check value of.
 * @return String describing value.
 */
function type_name(value) {
  if (typeof value === 'object') {
    return Array.isArray(value) ? 'array' : 'object';
  } else {
    return !!value || value === false ? 'value' : 'null';
  }
}

/**
 * Recursively checks for, subsitutes, and warns about missing config values.
 *
 * @param path Array of strings of "path" to current value.
 * @param config Object of config values to check
 * @param reference Object of default values as a reference.
 */
function check_values(path, config, reference) {
  Object.keys(reference).forEach(function(key) {
    var ref_value = reference[key];
    var cfg_value = config[key];
    var type = type_name(ref_value);

    if (cfg_value === undefined) {
      config[key] = ref_value;
      var period = path.length > 0 ? '.' : '';
      var path_str = path.join('.') + period + key;

      var default_value_str = '' + ref_value;
      if (type === 'object') {
        default_value_str = '(object)';
      } else if (type === 'array') {
        default_value_str = '(array)';
      } else if (typeof ref_value === 'string') {
        default_value_str = '"' + default_value_str + '"';
      }

      module.exports.warnings.push(
        'Config value ' + path_str.red.bold + ' not found. ' +
        'Please add it from config.example.js. Assuming default value: ' +
        default_value_str.bold);
    }

    if (type === 'object') {
      var new_path = path.slice(0);
      new_path.push(key);
      check_values(new_path, cfg_value || {}, ref_value);
    }
  });
}

// Check for missing config values.
check_values([], module.exports, default_values);

