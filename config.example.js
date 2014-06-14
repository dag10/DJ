/* config.js
 * Stores settings for the server.
 */

module.exports = {

  // Directory for logs.
  log_directory: __dirname + '/logs',

  // Directory for uploads.
  uploads_directory: __dirname + '/uploads',

  web: {
    // Host for the server.
    host: '0.0.0.0',

    // Port for the server.
    port: process.env.PORT || 9867,

    // Show stack trace on error page.
    debug: true,

    // Site title.
    title: 'CSH DJ',

    // Max upload file size (in mb).
    max_file_size: 50
  },

  auth: {
    // Method of ntication ('dev' or 'webauth').
    method: 'dev',

    webauth: {
      // URL for logging out of web
      logout_url: 'https://webauth.csh.rit.edu/logout'
    }
  },

  db: {
    // MySQL host.
    host: 'localhost',

    // MySQL username.
    username: 'user',

    // MySQL password (set null for no password).
    password: 'pass',

    // MySQL database.
    database: 'dj'
  },

  // Username of permanent admin.
  superadmin: 'dag10'

};

