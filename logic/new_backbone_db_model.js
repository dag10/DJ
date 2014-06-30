/* new_backbone_db_model.js
 * A base Backbone model that encapsulates a sequelize db model.
 * TODO: Rename to backbone_db_model when old one is no longer used.
 */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');

///////////////////////////////////////////////////////
//  TODO NEXT: Make this work for Sqeuelize model.   //
///////////////////////////////////////////////////////

module.exports = Backbone.Model.extend({
  defaults: {
    autosave: true
  },

  initialize: function() {
    if (!this.has('autosave'))
      this.set({ autosave: true });
    this.on('change', this.handleChange, this);
    this.on('change:instance', this.instanceChanged, this);
    this.on('change:id', this.idChanged, this);

    if (this.instance()) {
      this.instanceChanged();
    } else if (this.id) {
      this.idChanged();
    }
  },

  instance: function() {
    return this.get('instance');
  },

  model: function() {
    return this.get('model');
  },

  tableName: function() {
    if (this.model())
      return this.model().name;
    else
      return 'unknown';
  },

  getLogName: function() {
    var instance = this.instance();
    if (instance && typeof instance.getLogName === 'function')
      return instance.getLogName();
    return 'Unknown [' + this.tableName() + ']';
  },

  idChanged: function() {
    this.fetch();
  },

  instanceChanged: function() {
    var instance = this.instance();
    this.set({ id: instance.id }, { silent: true });

    // Copy db model attributes to backbone model.
    this.set(instance.dataValues, { silent: true });
  },
  
  handleChange: function() {
    if (this.get('autosave') && this.instance())
      this.save();
  },

  sync: function(method, model) {
    if (!this.model()) {
      winston.error('No model set, can\'t sync backbone db model.');
      return false;
    }

    winston.error('NOT IMPLEMENTED:', method, this.getLogName());
    return;

    var dbAttributes = Object.keys(this.model().tableAttributes);
    
    if (this.model().associations)
      dbAttributes = dbAttributes.concat(this.model().associations);

    if (method === 'create' || (method === 'update' && !this.instance())) {
      var attributesToSet = {};
      dbAttributes.forEach(_.bind(function(attr) {
        attributesToSet[attr] = this.get(attr);
      }, this));
      this.model().create([attributesToSet], _.bind(function(err, entities) {
        if (err) {
          winston.error(
            'Failed to save model ' + this.tableName() + ': ' + err);
        } else {
          this.set({ instance: entities[0] });
          this.trigger('save');
        }
      }, this));
    } else if (method === 'update') {
      var updated = false;
      var changedAttributesObj = this.changedAttributes() || {};
      var changedAttributes = Object.keys(changedAttributesObj);
      var instance = this.instance();
      _.intersection(
        dbAttributes, changedAttributes).forEach(_.bind(function(attr) {
          instance[attr] = this.get(attr);
          updated = true;
      }, this));
      if (updated) {
        this.instance().save(_.bind(function(err) {
          if (err)
            winston.error('Failed to save model: ' + this.tableName());
          else
            this.trigger('save');
        }, this));
      }
    } else if (method === 'delete') {
      if (this.instance()) {
        winston.info(
          'Deleted instance from backbone db model: ' + this.getLogName());
        this.instance().remove();
      }
    } else if (method === 'read') {
      if (this.has('id')) {
        this.model().get(this.id, _.bind(function(err, instance) {
          if (err) {
            winston.error('Error reading model from database: ' + err);
          } else {
            this.set({ instance: instance });
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

