/* database.js
 * Initializes the database connection.
 */

var config = require('./config');
var orm = require('orm');

exports.init = function(app, callback) {
  var opts = {
    host: config.db.mysql.host,
    database: config.db.mysql.database,
    user: config.db.mysql.username,
    password: config.db.mysql.password,
    port: '3306',
    protocol: 'mysql',
    query: {pool: true}
  };

  app.use(orm.express(opts, {
    define: function(db, models, next) {
      callback(db, models);
      next();
    }
  }));
};

