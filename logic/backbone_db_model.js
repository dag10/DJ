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

  initialize: function() {
    if (!this.has('autosave'))
      this.set({ autosave: true });
    this.on('change', this.handleChange, this);
    this.on('change:entity', this.entityChanged, this);
    this.on('change:id', this.idChanged, this);

    if (this.entity()) {
      this.entityChanged();
    } else if (this.id) {
      this.idChanged();
    }
  },

  entity: function() {
    return this.get('entity');
  },

  model: function() {
    return this.get('model');
  },

  tableName: function() {
    if (this.model())
      return this.model().table;
    else
      return 'unknown';
  },

  getLogName: function() {
    var entity = this.entity();
    if (entity && typeof entity.getLogName === 'function')
      return entity.getLogName();
    return 'Unknown (' + this.tableName() + ')';
  },

  idChanged: function() {
    this.fetch();
  },

  entityChanged: function() {
    var entity = this.entity();
    this.set({ id: entity.id }, { silent: true });

    // Copy db model attributes to backbone model.
    this.set(entity, { silent: true });
  },
  
  handleChange: function() {
    if (this.get('autosave') && this.entity())
      this.save();
  },

  sync: function(method, model) {
    if (!this.model()) {
      winston.error('No model set, can\'t sync backbone db model.');
      return false;
    }

    var dbAttributes = Object.keys(this.model().allProperties);
    
    if (this.model().associations)
      dbAttributes = dbAttributes.concat(this.model().associations);

    if (method === 'create' || (method === 'update' && !this.entity())) {
      var attributesToSet = {};
      dbAttributes.forEach(_.bind(function(attr) {
        attributesToSet[attr] = this.get(attr);
      }, this));
      this.model().create([attributesToSet], _.bind(function(err, entities) {
        if (err) {
          winston.error(
            'Failed to save model ' + this.tableName() + ': ' + err);
        } else {
          this.set({ entity: entities[0] });
          this.trigger('save');
        }
      }, this));
    } else if (method === 'update') {
      var updated = false;
      var changedAttributesObj = this.changedAttributes() || {};
      var changedAttributes = Object.keys(changedAttributesObj);
      var entity = this.entity();
      _.intersection(
        dbAttributes, changedAttributes).forEach(_.bind(function(attr) {
          entity[attr] = this.get(attr);
          updated = true;
      }, this));
      if (updated) {
        this.entity().save(_.bind(function(err) {
          if (err)
            winston.error('Failed to save model: ' + this.tableName());
          else
            this.trigger('save');
        }, this));
      }
    } else if (method === 'delete') {
      if (this.entity()) {
        winston.info(
          'Deleted entity from backbone db model: ' + this.getLogName());
        this.entity().remove();
      }
    } else if (method === 'read') {
      if (this.has('id')) {
        this.model().get(this.id, _.bind(function(err, entity) {
          if (err) {
            winston.error('Error reading model from database: ' + err);
          } else {
            this.set({ entity: entity });
            this.trigger('load');
          }
        }, this));
      } else {
        winston.error(
          'Can\'t read backbone db model because no id is set. Model: ' +
          this.tableName());
      }
    }
  }
});

