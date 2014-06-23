/* models.js
 * Loads and references sequelize models.
 */

var fs = require('fs');
var path = require('path');
var sequelize = require('../logic/database').sequelize;
var Q = require('q');

// List of models to load using sequelize.
// TODO: When all models are converted, just load all models in directory.
var new_models = [
];

// Initialized models.
exports.init = function() {
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
    var model = module.define();
    models[model.name] = model;
  });

  models.forEach(function(model) {
    model.associate(models);
  });

  deferred.resolve();
  return deferred.promise;
};

