/* config.js
 * Stores settings for the server.
 */

var config = {}

config.web = {};
config.auth = {};

// Port for the web server.
config.web.port = process.env.PORT || 9867;

// Directory of web templates.
config.web.views_directory = __dirname + '/views';

// Show stack trace on error page.
config.web.debug = true;

// Site title.
config.web.title = 'CSH DJ';

// Method of authentication ('dev' or 'webauth').
config.auth.method = 'dev';

module.exports = config;

