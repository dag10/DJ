/* database.js
 * Initializes the database connection.
 */

var config = require('./config');
var orm = require('orm');

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

  app.use(orm.express(opts, {
    define: function(db, models, next) {
      define(db, models, function() {
        next();
        _next();
      });
    }
  }));
};

