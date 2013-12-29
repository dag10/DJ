/* config.js
 * Stores settings for the server.
 */

var config = {};

config.web = {};
config.auth = {};
config.auth.webauth = {};
config.db = {};
config.db.mysql = {};

// Directory for logs.
config.log_directory = __dirname + '/logs';

// Port for the web server.
config.web.port = process.env.PORT || 9867;

// Show stack trace on error page.
config.web.debug = true;

// Site title.
config.web.title = 'CSH DJ';

// Method of authentication ('dev' or 'webauth').
config.auth.method = 'dev';

// URL for logging out of webauth.
config.auth.webauth.logout_url = 'https://webauth.csh.rit.edu/logout';

// MySQL host.
config.db.mysql.host = 'localhost';

// MySQL username.
config.db.mysql.username = 'user';

// MySQL password.
config.db.mysql.password = 'pass';

// MySQL database.
config.db.mysql.database = 'dj';

// Username of permanent admin.
config.superadmin = 'dag10';

module.exports = config;

