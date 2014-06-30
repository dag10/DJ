/* models.js
 * Loads and references sequelize models.
 */

var winston = require('winston');
var fs = require('fs');
var path = require('path');
var database = require('../logic/database');
var Q = require('q');

// List of models to load using sequelize.
// TODO: When all models are converted, just load all models in directory.
var new_models = [
  'user',
  'roomadmin',
  'room'
];

// Initialized models.
exports.init = function() {
  var sequelize = database.sequelize;

  var deferred = Q.defer(),
      models = {};

  var model_modules = fs.readdirSync(__dirname)
    .filter(function(file) {
      return new_models.indexOf(file.split('.')[0]) >= 0;
    })
    .map(function(file) {
      return require(path.join(__dirname, file));
    });

  model_modules.forEach(function(module) {
    /*jshint es5: true */
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
  .success(function() {
    winston.info('Completed sequelize migrations.');
    deferred.resolve();
  })
  .error(deferred.reject);

  return deferred.promise;
};

