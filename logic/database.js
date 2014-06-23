/* database.js
 * Initializes the database connection.
 */

var config = require('../config');
var orm = require('orm');
var winston = require('winston');
var Q = require('q');

exports.init = function(app, define) {
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

