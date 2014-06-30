/* rooms.js
 * Manages active rooms.
 */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');
var ConnectionManager = require('../connection/connection_manager');
var room_model = require('../../models/room');
var Room = require('../room/room');

var RoomManager = Backbone.Collection.extend({
  model: Room,

  /* Loading */

  initialize: function() {
    this.on('add', this.roomAdded, this);
    this.on('remove', this.roomRemoved, this);
  },

  loadRooms: function() {
    room_model.Model.findAll().success(_.bind(function(rooms) {
      rooms.forEach(_.bind(function(room) {
        this.add(new Room({ instance: room }));
      }, this));
      this.trigger('load');
    }, this));
  },

  /* Getters */

  roomForShortname: function(shortname) {
    return this.findWhere({ shortname: shortname }) || null;
  },

  /* Handlers */

  roomAdded: function(room) {
    winston.info('Room added: ' + room.getLogName());
  },

  roomRemoved: function(room) {
    winston.info('Room removed: ' + room.getLogName());
  }
});

module.exports = new RoomManager();

