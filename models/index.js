/* models index.js
 * Declares all models in the models directory.
 */

var config = require('../config');
var fs = require('fs');
var winston = require('winston');
var migrate = require('migrate');
var migration_utils = require('../utils/migration_utils.js');

function endsWith(str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

// Loads each module in this models directory.
exports.define = function(db, models, next) {
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

  // Define model migrations.
  migrate(__dirname + '/.migrate');
  modules.forEach(function(module) {
    if (module.migrate)
      module.migrate(migrate, db);
  });

  // Add migrations to convert all tables to utf8.
  Object.keys(models).forEach(function(model) {
    migrate('convert ' + model + ' to utf8', function(next) {
      migration_utils.runQueries([
        'ALTER TABLE `' + model + '` CONVERT TO CHARACTER SET utf8 ' +
        'COLLATE utf8_unicode_ci'
      ], db, 'song', next);
    }, function(next) {
      next();
    });
  });

  // Set up migrations.
  var set = migrate();
  var migrated = false;
  set.on('migration', function(migration, direction) {
    winston.info('Migrating ' + direction + ': "' + migration.title + '"');
    migrated = true;
  });

  // Migrate
  set.up(function(err) {
    if (err) {
      throw Error(err);
    } else {
      if (migrated)
        winston.info('Finished running migrations.');

      // Create any nonexistant model tables.
      // Note: This does not update table structures. You'll need to define
      //       migrations with SQL to update the table structures.
      db.sync(function(err) {
        if (err) {
          throw new Error(
              'Failed to synchronize model ' + err.model + ': ' + err);
        } else {
          winston.info('Database synchronized.');
          next();
        }
      });
    }
  });
};

