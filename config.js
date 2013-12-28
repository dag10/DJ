/* config.js
 * Stores settings for the server.
 */

var config = {}

config.web = {};
config.auth = {};
config.auth.webauth = {};

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

module.exports = config;

