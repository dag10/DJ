/* activity.js
 * Backbone models representing activities in the activity feed.
 */
/*jshint es5: true */

var Backbone = require('backbone');

// Incrementing ID for activities.
var nextActivityId = 1;

/** Base Activity model. */
exports.Activity = Backbone.Model.extend({
  defaults: {
    type: 'base'
  },

  initialize: function() {
    this.set({
      date: new Date(),
      id: nextActivityId++,
    });

    var user = this.get('user_model');
    if (user) {
      this.set({
        user_id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
      });
    }
  },

  toJSON: function() {
    var json = {};
    var _this = this;

    [ 'id',
      'type',
      'date',
      'user_id',
      'username',
      'firstName',
      'lastName',
      'fullName'].forEach(function(field) {
        json[field] = _this.get(field);
    });

    return json;
  }
});

/** Activity model representing a song having been played. */
exports.SongActivity = exports.Activity.extend({
  defaults: {
    skipVotes: 0,
    skipVoted: false,
    type: 'song'
  },

  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
    
    var song = this.get('song_model');
    if (song) {
      this.set({
        title: song.title,
        artist: song.artist,
        album: song.album,
        song_id: song.id,
        song_url: '/songs/' + song.file.filename,
      });
      if (song.artwork) {
        this.set({
         image_url: '/artwork/' + song.artwork.filename
        });
      }
    }
  },

  toJSON: function() {
    var json = this.constructor.__super__.toJSON.call(this);
    var _this = this;

    [ 'title',
      'artist',
      'album',
      'skipVotes',
      'skipVoted',
      'song_url',
      'image_url',
      'song_id'].forEach(function(field) {
        json[field] = _this.get(field);
    });

    return json;
  }
});

/** Activity model representing a user joining the room. */
exports.JoinActivity = exports.Activity.extend({
  defaults: {
    type: 'join'
  },

  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
  },
});

/** Activity model representing a user leaving the room. */
exports.LeaveActivity = exports.Activity.extend({
  defaults: {
    type: 'leave'
  },

  initialize: function() {
    this.constructor.__super__.initialize.apply(this, arguments);
  },
});

/** Collection holding Activities. */
exports.Activities = Backbone.Collection.extend({
  model: exports.Activity,
  comparator: 'date',

  initialize: function() {
    this.on('add', function() {
      while (this.length > 30) {
        this.remove(this.at(0));
      }
    });
  }
});

