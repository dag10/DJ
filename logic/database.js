/* database.js
 * Initializes the database connection.
 */

var config = require('../config');
var winston = require('winston');
var Q = require('q');
var Sequelize = require('sequelize');

// Sequelize object once initialized.
exports.sequelize = null;

// Initialize database with Sequelize.
exports.init = function() {
  var deferred = Q.defer();

  exports.sequelize = new Sequelize(
    config.db.database,
    config.db.username,
    config.db.password,
    {
      dialect: 'mysql',
      host: config.db.host,
      port: 3306,
      logging: winston.debug,
      define: {
        charset: 'utf8',
        collate: 'utf8_general_ci',
        instanceMethods: {
          getLogName: function() {
            var title = this.logNameTitle || this.Model.name;
            var name = this.logNameId || '';
            if (name.length > 0) name += ', ';
            var id = this.id || '--';
            return title + ' (' + name + id + ')';
          }
        }
      },
      pool: {
        maxConnections: 3,
        maxIdleTime: 20
      }
    });

  exports.sequelize.authenticate().complete(deferred.makeNodeResolver());

  return deferred.promise;
};

