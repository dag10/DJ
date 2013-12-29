/* models index.js
 * Declares all models in the models directory.
 */

var config = require('../config');
var fs = require('fs');
var winston = require('winston');

function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Loads each module in this models directory.
exports.define = function(db, models) {
  var modules = [];

  // Find modules in the models directory besides the index.
  fs.readdirSync('./models').forEach(function(file) {
    if (!endsWith(file, '.js')) return;
    if (file == 'index.js') return;
    modules.push(require('./' + file));
  });

  // Define model.
  modules.forEach(function(module) {
    module.define(db, models);
  });

  // Define model associations.
  modules.forEach(function(module) {
    if (module.associate)
      module.associate(models);
  });

  // Create any nonexistant model tables.
  // Note: This does not update table structures. You'll need to drop and
  //       recreate the tables. Perhaps I'll create a migration system
  //       at some point?
  db.sync(function(err) {
    if (err)
      throw new Error(
          'Failed to synchronize model ' + err.model + ': ' + err);
    else
      winston.info('Database synchronized.');
  });
};

