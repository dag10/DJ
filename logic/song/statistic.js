/* statistic.js
 * Backbone wrapper for a song statistic.
 */
/*jshint es5: true */

var song_statistic_model = require('../../models/songstatistic');
var BackboneDBModel = require('../backbone_db_model');

module.exports = BackboneDBModel.extend({
  model: function() {
    return song_statistic_model.Model;
  },
});

