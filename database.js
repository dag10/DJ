/* database.js
 * Initializes the database connection.
 */

var config = require('./config');
var orm = require('orm');

exports.init = function(app, callback) {
  if (config.db.type == 'sqlite') {
    throw Error('sqlite not supported yet');
    // TODO: Support sqlite, maybe.
  } else if (config.db.type == 'mysql') {
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
  }
};

