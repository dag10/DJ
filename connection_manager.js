/* connection_manager.js
 * An object for managing connection objects.
 */

var _ = require('underscore');
var Backbone = require('backbone');

module.exports = Backbone.Collection.extend({
  initialize: function() {
    this.on('add', function(connection) {
      connection.once('disconnect', _.bind(function() {
        this.remove(connection);
      }, this));
    }, this);
  },

  // Returns an array of connections for a username.
  connectionsForUsername: function(username) {
    return this.find({ username: username });
  },

  // Returns the first connection with a username, or null.
  connectionForUsername: function(username) {
    var connections = this.connectionsForUsername(username);
    if (connections && connections.length > 0)
      return connections[0];
    return null;
  },

  // Whether a connection with a username exists
  hasConnectionForUsername: function(username) {
    return this.connectionForUsername(username) !== null;
  }
});

