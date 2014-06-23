/* load_config.js
 * Loads config.js or outputs an error.
 */

var colors = require('colors');

if (require('fs').existsSync('./config.js')) {
  module.exports = require('../config');
} else {
  console.error(
    'Config file not found. Copy ' + 'config.example.js'.bold.green +
    ' to ' + 'config.js'.bold.green + ' and edit it as needed.');
  module.exports = null;
}

