/* config.js
 * Stores settings for the server.
 */

module.exports = {

  // Directory for logs.
  log_directory: __dirname + '/logs',

  // Directory for uploads.
  uploads_directory: __dirname + '/uploads',

  // Username of permanent admin.
  superadmin: 'dag10',

  // If true, uncaught errors won't be logged.
  debug: true,

  // If true and debug is true, socket.io debug messages will be logged.
  debug_socketio: false,

  // Maximum duration (in minutes) of songs that can be added.
  max_duration: 10,

  web: {
    // Host for the server.
    host: '0.0.0.0',

    // Port for the server.
    port: process.env.PORT || 9867,

    // Show stack trace on error page.
    debug: true,

    // Site title.
    title: 'CSH DJ',

    // Secret strong used for authentication. Make this unique.
    secret: 'change me!',

    // Max upload file size (in mb).
    max_file_size: 50
  },

  auth: {
    // Method of authentication (only available mode is 'dev').
    method: 'dev'
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

  song_sources: {
    // List of song source packages installed in the node_modules directory.
    external_modules: [
      //'cshdj-youtube'
    ],

    // Optional configuration objects for a song source.
    configurations: {
      //'cshdj-youtube': { }
    },

    // The order of song sources to display in search results, and the
    // maximum number of results to show per source.
    // Again, youtube is just a placeholder for future sources.
    results_format: {
      upload: 6
      //'cshdj-youtube': 4
    }
  }

};

