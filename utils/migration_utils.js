/* migration_utils.js
 * Utility functions for model migrations.
 */

exports.runQueries = function(queries, db, table, next) {
  if (db.driver_name == 'mysql') {
    // Only run queries if table exists. If table doesn't exist, it's assumed
    // that it will be created in the most up-to-date form with model sync.
    db.driver.poolQuery(
        'SHOW TABLES LIKE \'' + table + '\'', function(err, rows) {
      if (err)
        throw err;
      else if (rows.length > 0)
        db.driver.poolQuery(queries.join(';'), next);
      else
        next();
    });
  } else {
    next();
  }
};

