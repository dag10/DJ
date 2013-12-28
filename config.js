/* config.js
 * Stores settings for the server.
 */

var config = {}

config.web = {};

// Port for the web server.
config.web.port = process.env.PORT || 9867;

// Method of authentication ('dev' or 'webauth')
config.web.auth = 'dev';

module.exports = config;

