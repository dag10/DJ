/* models.js
 * Loads and references sequelize models.
 */
/*jshint es5: true */

var winston = require('winston');
var fs = require('fs');
var path = require('path');
var database = require('../logic/database');
var Q = require('q');

// Initialized models.
exports.init = function() {
  var sequelize = database.sequelize;

  var deferred = Q.defer(),
      models = {};

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

  sequelize.getMigrator({
    path: __dirname + '/migrations',
    filesFilter: /\.js$/,
    logging: winston.info
  })
  .migrate()
  .then(function() {
    winston.info('Completed sequelize migrations.');
    deferred.resolve();
  })
  .catch(deferred.reject);

  return deferred.promise;
};

