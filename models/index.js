/* models index.js
 * Declares all models in the models directory.
 */

var config = require('../config');
var fs = require('fs');

function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Loads each module in this models directory.
exports.define = function(db, models) {
  fs.readdirSync('./models').forEach(function(file) {
    if (!endsWith(file, '.js')) return;
    if (file == 'index.js') return;
    require('./' + file).define(db, models);
  });
};

