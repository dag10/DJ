/* connection_manager.js
 * An object for managing connection objects.
 */

var _ = require('underscore');
var Backbone = require('backbone');

module.exports = Backbone.Collection.extend({
  initialize: function() {
    this._numAuthenticated = 0;
    this.on('add', this.connectionAdded, this);
    this.on('remove', this.connectionRemoved, this);
  },

  /* Getters */

  // Returns an array of connections for a username.
  connectionsForUsername: function(username) {
    return this.where({ username: username });
  },

  // Returns the first connection with a username, or null.
  connectionForUsername: function(username) {
    var connections = this.connectionsForUsername(username);
    if (connections && connections.length > 0)
      return connections[0];
    return null;
  },

  // Whether a connection with a username exists.
  hasConnectionForUsername: function(username) {
    return this.connectionForUsername(username) !== null;
  },

  // Returns the number of connections.
  numConnections: function() {
    return this.length;
  },

  // Returns the number of authenticated connections.
  numAuthenticated: function() {
    return this._numAuthenticated;
  },

  // Returns the number of anonymous connections.
  numAnonymous: function() {
    return this.length - this._numAuthenticated;
  },

  /* Handlers */

  // Handle a connection being added.
  connectionAdded: function(conn) {
    if (conn.authenticated())
      this._numAuthenticated++;

    // Updated authenticated count if this connection's authentication changes
    conn.on('change:authenticated', function() {
      var wasAuthenticated = conn.previous('authenticated');
      var isAuthenticated = conn.authenticated();

      if (wasAuthenticated && !isAuthenticated)
        this._numAuthenticated--;
      else if (!wasAuthenticated && isAuthenticated)
        this._numAuthenticated++;
    }, this);

    // Remove the connection once it's disconnected.
    conn.once('disconnect', function() {
      this.remove(conn);
    }, this);
  },

  // Handle a connection being removed.
  connectionRemoved: function(conn) {
    if (conn.authenticated())
      this._numAuthenticated--;
  }
});

