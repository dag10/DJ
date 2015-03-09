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

  // Seconds of delay between starting the next song.
  playback_gap: 1,

  // Maximum duration (in minutes) of songs that can be added.
  max_duration: 10,

  transcoding: {
    // Maximum number of jobs to run concurrently, due to memory use.
    max_concurrent_jobs: 2
  },

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
    // Method of authentication (options are 'dev' or 'ldap').
    method: 'dev',

    // Settings relating to the LDAP method of authentication.
    ldap: {
      // If true, create full name by joining first and last.
      strictFullName: true,

      // URL of LDAP server, with protocol and optionally a port.
      // No trailing slash.
      baseURL: 'ldap://ldap.csh.rit.edu',

      // Base dn for user searches.
      dnBase: 'ou=Users,dc=csh,dc=rit,dc=edu',

      // DN format for auth. Put %username% where the username will be.
      dnFormat: 'uid=%username%,ou=Users,dc=csh,dc=rit,dc=edu',

      // Filter for searching for the user. Put %username% as a placeholder.
      filter: '(&(objectclass=houseMember)(uid=%username%))',

      // Attributes for fetching name info from a found user entry.
      // Required: firstName, lastName, fullName.
      attributes: {
        firstName: 'givenName',
        lastName: 'sn',
        fullName: 'cn'
      }
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

  song_sources: {
    // List of song source packages installed in the node_modules directory.
    external_modules: [
      //'cshdj-soundcloud'
    ],

    // Optional configuration objects for a song source.
    configurations: {
      //'cshdj-soundcloud': { }
    },

    // The order of song sources to display in search results, and the
    // maximum number of results to show per source.
    results_format: {
      upload: 6
      //'cshdj-soundcloud': 4
    }
  }

};

