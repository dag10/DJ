/* room.js
 * Backbone model to define behavior for a room.
 */
/*jshint es5: true */

var winston = require('winston');
var _ = require('underscore');
var room_model = require('../../models/room');
var ConnectionManager = require('../connection/connection_manager');
var BackboneDBModel = require('../backbone_db_model');
var connections = require('../connection/connections');
var SongPlayback = require('../song/song_playback.js');
var activity = require('./activity');

/**
 * Calculate number of skip votes needed for a give number of listeners.
 *
 * @param users Number of authenticated users in the room, including DJs.
 * @returns Number of skip votes needed to trigger a skip.
 */
function skipVotesForUserCount(count) {
  if (count <= 2) return count;
  return Math.ceil(Math.sqrt(count));
}

module.exports = BackboneDBModel.extend({
  initialize: function() {
    this.set({
      activities: new activity.Activities(),
      connections: new ConnectionManager(),
      playback: new SongPlayback(),
    });

    // Initially reset all voting numbers.
    this.resetVotes();

    // Handle when a song starts playing.
    this.playback().on('play', function() {
      winston.info(
        this.playback().dj().getLogName() + ' started playing song ' +
        this.playback().song().getLogName() + ' in room ' + this.getLogName());
      var songActivity = new activity.SongActivity({
        user_model: this.playback().dj().user(),
        song_model: this.playback().song()
      });
      this.set({ currentSongActivity: songActivity });
      this.activities().add(songActivity);
    }, this);

    // When songs are no longer being played...
    this.playback().on('stop', function() {
      winston.info(this.getLogName() + ' is no longer playing a song.');
    }, this);

    // When the song playback finishes normally, start the next song.
    this.playback().on('finish', this.playNextSong, this);

    // When an activity is added or changed, notify the room's users.
    this.activities().on('add change', function(activity) {
      this.broadcastActivity(activity);
    }, this);

    // When the current song ends for any reason...
    this.playback().on('end', function() {
      this.unset('currentSongActivity'); // Forget its associated activity.
      this.resetVotes();
    }, this);

    // When any vote numbers change...
    this.on(
      'change:numSkipVotes change:numSkipVotesNeeded change:numLikes',
      function() {
        var likes = this.numLikes();
        var skipVotes = this.numSkipVotes();
        var skipVotesNeeded = this.numSkipVotesNeeded();

        // Update the song activity's vote count.
        var songActivity = this.get('currentSongActivity');
        if (songActivity) {
          songActivity.set({
            skipVotes: skipVotes,
            likes: likes,
          });
        }

        // Decide if the vote has been one.
        this.broadcastVotes();
        if (skipVotes >= skipVotesNeeded && skipVotes > 0) {
          this.skipVotePassed();
        }
      }, this);

    // Call event handlers when a user joins or leaves.
    this.connections().on('add', this.connectionAdded, this);
    this.connections().on('remove', this.connectionRemoved, this);
    
    // BackboneDBModel initializer.
    this.constructor.__super__.initialize.apply(this, arguments);
  },

  model: function() {
    return room_model.Model;
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

  activities: function() {
    return this.get('activities');
  },

  connections: function() {
    return this.get('connections');
  },

  playback: function() {
    return this.get('playback');
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

  getCurrentDJ: function() {
    var djs = this.getDJs();
    if (!djs) return null;
    return _.sortBy(djs, function(conn) {
      return conn.get('djOrder');
    })[0];
  },

  numDJs: function() {
    return this.getDJs().length;
  },

  likes: function() {
    return this.get('likes');
  },

  numLikes: function() {
    return this.get('numLikes');
  },

  skipVotes: function() {
    return this.get('skipVotes');
  },

  numSkipVotes: function() {
    return this.get('numSkipVotes');
  },

  numSkipVotesNeeded: function() {
    return this.get('numSkipVotesNeeded');
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

  broadcastActivity: function(activity) {
    this.eachConnection(function(conn) {
      conn.sendRoomActivity(activity);
    });
  },

  broadcastVotes: function() {
    this.eachConnection(function(conn) {
      conn.sendVotes(
        this.numSkipVotes(), this.numSkipVotesNeeded(), this.numLikes());
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
      skipVoted: false,
      liked: false,
      isDJ: false
    });

    // Broadcast information to others.
    if (conn.authenticated()) {
      this.broadcastUserJoined(conn);
      winston.info(
        conn.user().getLogName() + ' joined room: ' + this.getLogName()); 
      this.activities().add(new activity.JoinActivity({
        user_model: conn.user()
      }));
    } else {
      this.broadcastNumAnonymous();
      winston.info('An anonymous listener joined room: ' + this.getLogName());
    }
    
    this.updateSkipVotesNeeded();

    // Send this user all room data.
    conn.sendUserList(this.getAuthenticatedConnections());
    conn.sendNumAnonymous(this.numAnonymous());
    conn.sendRoomActivities(this.activities());
    conn.sendVotes(
      this.numSkipVotes(), this.numSkipVotesNeeded(), this.numLikes());
    conn.sendVotes(
      this.numSkipVotes(), this.numSkipVotesNeeded(), this.numLikes());

    conn.on('change', this.connectionUpdated, this);
  },

  connectionRemoved: function(conn) {
    conn.off('change', this.connectionUpdated);

    if (conn.get('room') === this) {
      conn.unset('room');
    }

    if (conn.get('isDJ')) {
      this.endDJ(conn);
    }
    
    this.removeSkipVote(conn);
    this.removeLike(conn);
    this.updateSkipVotesNeeded();

    // Broadcast information to others
    if (conn.authenticated()) {
      this.broadcastUserLeft(conn);
      winston.info(
        conn.user().getLogName() + ' left room: ' + this.getLogName()); 
      this.activities().add(new activity.LeaveActivity({
        user_model: conn.user()
      }));
    } else {
      this.broadcastNumAnonymous();
      winston.info('An anonymous listener left room: ' + this.getLogName());
    }
  },

  connectionUpdated: function(conn) {
    var relevantAttributes = [
      'isDJ', 'djOrder', 'admin', 'skipVoted', 'liked'];
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

  /* Song Management */

  playNextSong: function() {
    this.rotateDJs();

    var currentDJ = this.getCurrentDJ();
    if (currentDJ) {
      // If playing, trigger end so that previous queue rotates
      if (this.playback().playing())
        this.playback().trigger('end');

      var nextQueuedSong = currentDJ.get('queue').getNextSong();
      if (nextQueuedSong) {
        this.playback().play(nextQueuedSong.get('song'), currentDJ);
        nextQueuedSong.set({ playing: true });
        this.playback().once('end', function() {
          currentDJ.get('queue').rotate();
          nextQueuedSong.set({ playing: false });
        }, this);
      } else {
        this.endDJ(currentDJ);
      }
    } else {
      this.playback().stop();
    }
  },

  /* Vote Management */

  resetVotes: function() {
    this.set({
      likes: [],
      numLikes: 0,
      skipVotes: [],
      numSkipVotes: 0,
      numSkipVotesNeeded: skipVotesForUserCount(this.numUsers()),
    });

    this.eachConnection(function(conn) {
      conn.set({
        skipVoted: false,
        liked: false,
      });
    });
  },

  postLike: function(conn) {
    if (this.getCurrentDJ() === conn) {
      return new Error('User is the current DJ.');
    } else if (this.voted(conn)) {
      return new Error('User already voted.');
    }

    conn.set({ liked: true });
    var likes = this.likes();
    likes.push(conn);
    this.set({ 'numLikes': likes.length });
  },

  removeLike: function(conn) {
    var likes = this.likes();
    var index = likes.indexOf(conn);
    if (index < 0) return;
    likes.splice(index, 1);
    this.set({ 'numLikes': likes.length });
    conn.set({ liked: false });
  },

  postSkipVote: function(conn) {
    if (this.getCurrentDJ() === conn) {
      return new Error('User is the current DJ.');
    } else if (this.voted(conn)) {
      return new Error('User already voted.');
    }

    conn.set({ skipVoted: true });
    var skipVotes = this.skipVotes();
    skipVotes.push(conn);
    this.set({ 'numSkipVotes': skipVotes.length });
  },

  removeSkipVote: function(conn) {
    var skipVotes = this.skipVotes();
    var index = skipVotes.indexOf(conn);
    if (index < 0) return;
    skipVotes.splice(index, 1);
    this.set({ 'numSkipVotes': skipVotes.length });
    conn.set({ skipVoted: false });
  },

  liked: function(conn) {
    return (this.likes().indexOf(conn) >= 0);
  },

  skipVoted: function(conn) {
    return (this.skipVotes().indexOf(conn) >= 0);
  },

  voted: function(conn) {
    return this.liked(conn) || this.skipVoted(conn);
  },

  updateSkipVotesNeeded: function() {
    this.set({ numSkipVotesNeeded: skipVotesForUserCount(this.numUsers()) });
  },

  skipVotePassed: function() {
    this.get('currentSongActivity').set({ skipVoted: true });
    this.playNextSong();
  },

  /* Activity Management */

  activityEnqueued: function(activity_id) {
    var songActivity = this.activities().get(activity_id);
    if (!songActivity) return;
    songActivity.set({ enqueueings: songActivity.get('enqueueings') + 1 });
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
    if (conn.get('queue').length === 0)
      return 'Your queue is empty.';

    conn.set({
      djOrder: numDJs + 1,
      isDJ: true
    });

    if (!this.playback().playing())
      this.playNextSong();
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

    if (conn === this.playback().dj())
      this.playNextSong();
  },

  rotateDJs: function() {
    var djs = this.getDJs();
    var currentDJ = this.getCurrentDJ();
    if (!djs || !currentDJ) return;

    _.sortBy(djs, function(conn) {
      return conn.get('djOrder');
    }).forEach(function(conn) {
      if (conn === currentDJ)
        conn.set({ djOrder: djs.length });
      else
        conn.set({ djOrder: conn.get('djOrder') - 1 });
    });
  }
});

