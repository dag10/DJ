/* database.js
 * Initializes the database connection.
 */

var config = require('../config');
var orm = require('orm');
var winston = require('winston');
var Q = require('q');
var Sequelize = require('sequelize');

// Initialize database with Sequelize.
exports.init = function() {
  var deferred = Q.defer();

  new Sequelize(
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
        collate: 'utf8_general_ci'
      },
      pool: {
        maxConnections: 3,
        maxIdleTime: 20
      }
    })
  .authenticate()
  .complete(deferred.makeNodeResolver());

  return deferred.promise;
};

// Initialize database with to-be-deprecated node-orm2.
exports.initOld = function(app, define) {
  var deferred = Q.defer();

  var opts = {
    host: config.db.host,
    database: config.db.database,
    user: config.db.username,
    password: config.db.password,
    port: '3306',
    protocol: 'mysql',
    query: {pool: true},
    multipleStatements: true
  };

  // Ensures that the tables are utf8, since we neither orm nor node-mysql
  // let us properly change the charset and collation.
  var charset_query = 'ALTER DATABASE `' + opts.database +
      '` DEFAULT CHARACTER SET utf8 DEFAULT COLLATE utf8_unicode_ci';

  app.use(orm.express(opts, {
    define: function(db, models, next) {
      db.driver.poolQuery(charset_query, function(err) {
        if (err) {
          winston.error('Failed to set db charset to utf8.');
          deferred.reject(err);
        } else {
          define(db, models, function() {
            next();
            deferred.resolve();
          });
        }
      });
    }
  }));

  return deferred.promise;
};

