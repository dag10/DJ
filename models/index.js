/* models.js
 * Loads and references sequelize models.
 */
/*jshint es5: true */

var winston = require('winston');
var fs = require('fs');
var path = require('path');
var database = require('../logic/database');
var Umzug = require('umzug');
var Q = require('q');

// Initialized models.
exports.init = function() {
  var sequelize = database.sequelize;

  var models = {};

  var model_modules = fs.readdirSync(__dirname)
    .filter(function(file) {
      var tokens = file.split('.');
      var first = tokens[0];
      return tokens.length > 1 && first.length > 0 && first !== 'index';
    })
    .map(function(file) {
      return require(path.join(__dirname, file));
    });

  model_modules.forEach(function(module) {
    var model = sequelize.import(module.name, module.define);
    models[module.name] = model;
  });

  Object.keys(models).forEach(function(model_name) {
    var model = models[model_name];
    if (typeof model.associate === 'function') {
      model.associate(models);
    }
  });

  var umzug = new Umzug({
    storage: 'sequelize',
    storageOptions: {
      sequelize: sequelize,
    },
    logging: winston.info,
    migrations: {
      path: __dirname + '/migrations',
      pattern: /\.js$/,
    },
  });

  // TODO: I cannot switch migrators because of an incompatile meta table format.
  // I created an issue: https://github.com/sequelize/umzug/issues/23

  return umzug
  .pending()
  .then(function(migrations) {
    if (migrations) {
      winston.info('Found ' + migrations.length + ' pending migrations.');
      return; // TODO: Delete this line when it works.
      return umzug.execute({
        migrations: migrations,
        method: 'up',
      })
      .then(function(migrations) {
        winston.info(
          'Successfully executed ' + migrations.length + ' migrations.');
      });
    }
  });
};

