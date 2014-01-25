/* backbone_db_model.js
 * A base Backbone model that encapsulates a db model.
 */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');

module.exports = Backbone.Model.extend({
  defaults: {
    autosave: true
  },

  initialize: function(entity) {
    this.on('change:entity', this.entityChanged, this);
    this.set({ entity: entity });
  },

  entity: function() {
    return this.get('entity');
  },

  tableName: function() {
    return this.entity().model().table;
  },

  getLogName: function() {
    var entity = this.entity();
    if (entity && typeof entity.getLogName === 'function')
      return entity.getLogName();
    return 'Unknown (' + this.tableName + ')';
  },

  entityChanged: function() {
    var entity = this.entity();

    // Copy db model attributes to backbone model.
    this.set(entity, { silent: true });
    this.set({ model: entity.model });

    // When one of these attributes is changed in the backbone model, update
    // and save the db model if autosave is enabled.
    var dbAttributes = Object.keys(entity.model().allProperties);
    this.on('change', function() {
      if (!this.get('autosave')) return;
      var updated = false;
      var changedAttributes = Object.keys(this.changedAttributes());
      _.intersection(
        dbAttributes, changedAttributes).forEach(_.bind(function(attr) {
          entity[attr] = this.get(attr);
          updated = true;
      }, this));
      if (updated) this.save();
      else winston.info('No update!');
    }, this);
  },

  sync: function(method, model) {
    this.entity().save(_.bind(function(err) {
      if (err) {
        winston.error('Failed to save model: ' + this.tableName());
      }
    }, this));
  }
});

