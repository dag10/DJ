/* room.js
 * Backbone model to define behavior for a room.
 */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');
var ConnectionManager = require('./logic/connection/connection_manager');
var BackboneDBModel = require('./backbone_db_model');
var connections = require('./logic/connection/connections');

module.exports = BackboneDBModel.extend({
  initialize: function(entity) {
    this.constructor.__super__.initialize.apply(this, arguments);
    this.set({ connections: new ConnectionManager() });
    this.connections().on('add', this.connectionAdded, this);
    this.connections().on('remove', this.connectionRemoved, this);
  },

  /* Utilities */

  eachConnection: function(func) {
    this.connections().forEach(func, this);
  },

  updateDJOrder: function() {
    var index = 1;
    var djs = this.connections().where({ isDJ: true });

    _.sortBy(djs, function(conn) {
      return conn.get('djOrder');
    }).forEach(function(conn) {
      conn.set({ djOrder: index++ });
    });
  },

  /* Getters */

  connections: function() {
    return this.get('connections');
  },

  numUsers: function() {
    return this.connections().numAuthenticated();
  },

  numAnonymous: function() {
    return this.connections().numAnonymous();
  },

  getAuthenticatedConnections: function() {
    return this.connections().where({ authenticated: true });
  },

  getDJs: function() {
    return this.connections().where({ isDJ: true });
  },

  numDJs: function() {
    return this.getDJs().length;
  },

  /* Broadcast Commands */

  broadcastNumAnonymous: function() {
    var num = this.numAnonymous();
    this.eachConnection(function(conn) {
      conn.sendNumAnonymous(num);
    });
  },

  broadcastUserJoined: function(user) {
    this.eachConnection(function(conn) {
      conn.sendJoinedUser(user);
    });
  },

  broadcastUserLeft: function(user) {
    this.eachConnection(function(conn) {
      conn.sendLeftUser(user);
    });
  },

  broadcastUserUpdate: function(user) {
    this.eachConnection(function(conn) {
      conn.sendUpdatedUser(user);
    });
  },

  /* Connection Management */

  addConnection: function(conn) {
    if (conn.authenticated()) {
      var instances = connections.connectionsForUsername(
        conn.user().username);
      instances.forEach(_.bind(function(connection) {
        if (connection.get('room'))
          connection.kick('You joined another room: ' + this.get('name'));
      }, this));
    }

    this.connections().add(conn);
  },

  removeConnection: function(conn) {
    this.connections().remove(conn);
  },

  /* Handlers */

  connectionAdded: function(conn) {
    conn.set({
      room: this,
      isDJ: false
    });

    // Broadcast information to others.
    if (conn.authenticated()) {
      this.broadcastUserJoined(conn);
      winston.info(
        conn.user().getLogName() + ' joined room: ' + this.getLogName()); 
    } else {
      this.broadcastNumAnonymous();
      winston.info('An anonymous listener joined room: ' + this.getLogName());
    }

    // Send this user room all data.
    conn.sendUserList(this.getAuthenticatedConnections());
    conn.sendNumAnonymous(this.numAnonymous());

    conn.on('change', this.connectionUpdated, this);
  },

  connectionRemoved: function(conn) {
    conn.off('change', this.connectionUpdated);
    if (conn.get('room') === this)
      conn.unset('room');

    if (conn.get('isDJ'))
      this.endDJ(conn);

    // Broadcast information to others
    if (conn.authenticated()) {
      this.broadcastUserLeft(conn);
      winston.info(
        conn.user().getLogName() + ' left room: ' + this.getLogName()); 
    } else {
      this.broadcastNumAnonymous();
      winston.info('An anonymous listener left room: ' + this.getLogName());
    }
  },

  connectionUpdated: function(conn) {
    var relevantAttributes = ['isDJ', 'djOrder', 'admin'];
    var changedAttributes = Object.keys(conn.changedAttributes());

    if (_.intersection(relevantAttributes, changedAttributes).length === 0)
      return;

    if (conn.hasChanged('isDJ')) {
      if (conn.get('isDJ')) {
        winston.info(
          conn.user().getLogName() + ' is now a DJ in: ' + this.getLogName());
      } else {
        winston.info(
          conn.user().getLogName() + ' is no longer a DJ in: ' +
          this.getLogName());
      }
    }

    if (conn.authenticated())
      this.broadcastUserUpdate(conn);
  },

  /* DJ Management */

  makeDJ: function(conn) {
    var numDJs = this.numDJs();

    if (!conn.authenticated())
      return 'User is not authenticated.';
    if (conn.get('isDJ'))
      return 'User is already DJ.';
    if (numDJs >= this.get('slots'))
      return 'All DJ slots are full.';

    conn.set({
      djOrder: numDJs + 1,
      isDJ: true
    });
  },

  endDJ: function(conn) {
    var numDJs = this.numDJs();

    if (!conn.authenticated())
      return 'User is not authenticated.';
    if (!conn.get('isDJ'))
      return 'User is not a DJ.';

    conn.set({ isDJ: false });
    conn.unset('djOrder');
    this.updateDJOrder();
  }
});

