/* database.js
 * Initializes the database connection.
 */

var config = require('../config');
var orm = require('orm');
var winston = require('winston');

exports.init = function(app, define, next) {
  var opts = {
    host: config.db.mysql.host,
    database: config.db.mysql.database,
    user: config.db.mysql.username,
    password: config.db.mysql.password,
    port: '3306',
    protocol: 'mysql',
    query: {pool: true},
    multipleStatements: true
  };

  var _next = next;

  // Ensures that the tables are utf8, since we neither orm nor node-mysql
  // let us properly change the charset and collation.
  var charset_query = 'ALTER DATABASE `' + opts.database +
      '` DEFAULT CHARACTER SET utf8 DEFAULT COLLATE utf8_unicode_ci';

  app.use(orm.express(opts, {
    define: function(db, models, next) {
      db.driver.poolQuery(charset_query, function(err) {
        if (err) {
          winston.error('Failed to set db charset to utf8.');
          throw err;
        }
        define(db, models, function() {
          next();
          _next(models);
        });
      });
    }
  }));
};

