/* song_playback.js
 * Model representing the playback of a song.
 */

var config = require('../../config.js');
var _ = require('underscore');
var Backbone = require('backbone');
var fs = require('fs');
var lame = require('lame');

module.exports = Backbone.Model.extend({
  defaults: {
    playing: false
  },

  initialize: function() {
    this.set({
      fileStream: null,
      decoder: null,
      encoder: null,
      streaming: false,
      segments: [],
      segments_loaded: false,
      played_segments: 0
    });
    this.once('segment_load', this.sendSegment, this);
  },

  /* Playback Control */

  play: function(song_entity, dj) {
    if (this.playing())
      this._stop();

    this.set({
      song: song_entity,
      dj: dj,
      timeStarted: new Date(),
      playing: true
    });

    this.set({
      finishedTimeout: setTimeout(
        _.bind(this.finished, this), this.millisecondsRemaining())
    });

    this.startStream();

    this.trigger('play');
  },

  _stop: function() {
    this.set({ playing: false });
    
    if (this.has('finishedTimeout')) {
      clearTimeout(this.get('finishedTimeout'));
      this.unset('finishedTimeout');
    }

    this.unset('song');
    this.unset('dj');
    this.unset('timeStarted');

    this.stopStream();

    this.trigger('end');
  },

  stop: function() {
    this._stop();
    this.trigger('stop');
  },

  finished: function() {
    this._stop();
    this.trigger('finish');
  },

  /* Getters */

  song: function() {
    return this.get('song');
  },

  dj: function() {
    return this.get('dj');
  },

  playing: function() {
    return this.get('playing');
  },

  millisecondsRemaining: function() {
    if (!this.has('timeStarted'))
      return 0;

    return (
      (this.song().duration * 1000) + 
      new Date().valueOf() - this.get('timeStarted').valueOf());
  },

  fileStream: function() {
    return this.get('fileStream');
  },

  encoder: function() {
    return this.get('encoder');
  },

  decoder: function() {
    return this.get('decoder');
  },

  segments: function() {
    return this.get('segments');
  },

  toJSON: function() {
    var ret = {
      playing: this.playing()
    };

    var song = this.song();
    if (song) {
      ret.title = song.title;
      ret.artist = song.artist;
      ret.album = song.album;
      ret.duration = song.duration;

      // ms elapsed since song start
      ret.elapsed = new Date().valueOf() - this.get('timeStarted').valueOf();

      ret.song_path = '/songs/' + song.file.filename;

      if (song.artwork) {
        ret.artwork_path = '/artwork/' + song.artwork.filename;
      }
    }

    return ret;
  },

  /* Streaming */

  startStream: function() {
    if (this.get('streaming')) {
      this.stopStream();
    }

    var song = this.song();
    if (!song) return;

    // Create file read stream.
    var path = config.uploads_directory + '/songs/' + song.file.filename;
    var fileStream = fs.createReadStream(path);

    // Create mp3 decoder.
    var decoder = lame.Decoder();

    // Create mp3 encoder.
    var encoder = lame.Encoder({
      channels: 2,
      bitDepth: 16,
      sampleRate: 44100
    });

    // Once decoder reads mp3 format, start piping data to encoder.
    decoder.on('format', function(format) {
      decoder.pipe(encoder);
    });

    // When the encoder receives mp3 segments, push them to the queue.
    encoder.on('segment', _.bind(function(segment) {
      if (encoder !== this.get('encoder')) {
        return;
      }
      this.segments().push(segment);
      this.trigger('segment_load', segment);
    }, this));

    // Listen for data from the encoder stream but ignore it, since we're
    // ultimately using that data via its 'segment' event instead. We need
    // to at least listen for the 'data' event to drain the stream, though.
    encoder.on('data', function(data) {
      // nothing.
    });

    // When the encoder ends, update segments_loaded and notify listeners.
    encoder.on('end', _.bind(function() {
      if (encoder !== this.get('encoder')) {
        return;
      }
      this.set({ segments_loaded: true });
      this.trigger('segments_loaded');
    }, this));
    
    this.set({
      fileStream: fileStream,
      encoder: encoder,
      decoder: decoder,
      streaming: true
    });

    fileStream.pipe(decoder);
    this.trigger('stream_start');
  },

  stopStream: function() {
    var segment_timeout = this.get('segment_timeout');
    var fileStream = this.fileStream();
    var decoder = this.decoder();
    var encoder = this.encoder();
    var segments = this.segments();

    if (segment_timeout) {
      clearTimeout(segment_timeout);
      this.unset('segment_timeout');
      this.once('segment_load', this.sendSegment, this);
    }

    if (fileStream) {
      fileStream.unpipe();
      fileStream.close();
      this.unset('fileStream');
    }

    if (decoder) {
      decoder.unpipe();
      decoder.end();
      this.unset('decoder');
    }

    if (encoder) {
      encoder.end();
      this.unset('encoder');
    }

    if (segments) {
      segments.length = 0;
    }

    this.set({
      segments_loaded: false,
      played_segments: 0,
      streaming: false
    });
    this.trigger('stream_end');
  },

  sendSegment: function() {
    var segment = this.segments().shift();

    if (!segment) {
      this.once('segment_load', this.sendSegment, this);
      return;
    }

    var sampleRate = this.encoder().sampleRate;
    var segment_duration = segment.num_samples / sampleRate * 1000;

    this.set({
      segment_timeout: setTimeout(
        _.bind(this.sendSegment, this), segment_duration),
      played_segments: this.get('played_segments') + 1
    });
    this.trigger('segment', segment.data);
  }
});

