/* rooms.js
 * Manages active rooms.
 */

var models;
var rooms = [];
var roomsByShortname = {};

exports.init = function(_models, next) {
  models = _models;
  models.room.find({}, function(err, roomResults) {
    roomResults.forEach(function(room) {
      exports.addRoom(room);
    });
    next();
  });
};

exports.addRoom = function(room) {
  room.users = [];

  rooms.push(room);
  roomsByShortname[room.shortname] = room;
};

exports.getRoom = function(shortname) {
  if (shortname in roomsByShortname)
    return roomsByShortname[shortname];
  else
    return null;
};

exports.getRooms = function() {
  return rooms;
};

