/* room.js
 * Room model.
 */

var orm = require('orm');

var Room;

exports.define = function(db, models) {
  Room = db.define('room', {
    shortname: {
      type: 'text', required: true },
    name: {
      type: 'text', required: true },
    timeCreated: {
      type: 'date', required: true },
    slots: {
      type: 'number', required: true, defaultValue: 5 }
  }, {
    validations: {
      name: orm.enforce.unique({ ignoreCase: true })
    },
    methods: {
      getLogName: function() {
        return this.name + ' (' + this.shortname + ')';
      }
    }
  });

  exports.Room = models.room = Room;
};

exports.associate = function(models) {
  Room.associations = ['admin'];
  Room.hasOne('admin', models.person, {
    reverse: 'rooms'
  });
};

exports.generateShortName = function(name) {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w\-]/g, '');
};

