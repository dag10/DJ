/* backbone_db_model.js
 * A base Backbone model that encapsulates a db model.
 */

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

  getLogName: function() {
    var entity = this.entity();
    if (entity && typeof entity.getLogName === 'function')
      return entity.getLogName();
    return null;
  },

  entityChanged: function() {
    var entity = this.entity();

    // Copy db model attributes to backbone model.
    this.set(entity, { silent: true });
    this.set({ model: entity.model });

    // When one of these attributes is changed in the backbone model, update
    // and save the db model if autosave is enabled.
    this.off('change', this.save);
    Object.keys(entity).forEach(_.bind(function(key) {
      this.on('change:' + key, function() {
        if (this.get('autosave'))
          this.save();
      }, this);
    }, this));
  },

  sync: function(method, model) {
    this.entity().save(_.bind(function(err) {
      if (err) {
        winston.error('Failed to save model: ' + this.get('model'));
      } else {
        winston.info('Saved model: ' + this.get('model')); // TODO delete
      }
    }, this));
  }
});

