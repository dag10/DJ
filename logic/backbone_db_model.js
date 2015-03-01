/* backbone_db_model.js
 * A base Backbone model that encapsulates a sequelize db model.
 */
/*jshint es5: true */

var winston = require('winston');
var _ = require('underscore');
var Backbone = require('backbone');
var Q = require('q');

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

  /**
   * Sets associations on the given instance and from the backbone model.
   *
   * Inheriting models that have associations must override this method.
   *
   * @param instance The sequelize instance to set associations on.
   * @return Promise for the operation.
   */
  setAssociations: function(instance) {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  },

  /**
   * Gets associations from the given instance and sets them in the backbone
   * model.
   *
   * Inheriting models that have associations must override this method.
   *
   * @param instance The sequelize instance to load associations from.
   * @return Promise for the operation.
   */
  getAssociations: function(instance) {
    var deferred = Q.defer();
    deferred.resolve();
    return deferred.promise;
  },

  sync: function(method, model) {
    if (!this.model()) {
      winston.error('No model set, can\'t sync backbone db model.');
      return false;
    }

    var dbAttributes = Object
      .keys(this.model().tableAttributes)
      .filter(function(key) {
        return ['createdAt', 'updatedAt'].indexOf(key) < 0;
      });

    if (method === 'create' || (method === 'update' && !this.instance())) {
      var attributesToSet = {};
      dbAttributes.forEach(_.bind(function(attr) {
        attributesToSet[attr] = this.get(attr);
      }, this));

      var new_instance = this.model().build(attributesToSet);

      this
      .setAssociations(new_instance)
      .then(_.bind(function() {
        new_instance
        .save()
        .then(function() {
          this.set({ new_instance: new_instance });
          this.trigger('save');
        })
        .catch(_.bind(function(err) {
          if (err && err.event && err.event[0] && err.event[0].message) {
            winston.error(err.event[0].message);
          } else {
            winston.error(
              'An unknown error occurred while saving BackboneDBModel for ' +
              this.model().name + ': ' + err.stack);
          }
        }, this));
      }, this))
      .catch(_.bind(function(err) {
        if (err && err.event && err.event[0] && err.event[0].message) {
          winston.error(err.event[0].message);
        } else {
          winston.error(
            'An unknown error occurred while setting assocations in ' +
            'BackboneDBModel for ' + this.model().name + ': ' + err.stack);
        }
      }, this))
      .done();

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
        this.instance()
        .save()
        .catch(_.bind(function(err) {
          winston.error('Failed to save model: ' + this.tableName());
        }, this))
        .then(_.bind(function() {
          this.trigger('save');
        }, this));
      }

    } else if (method === 'delete') {
      var instance_to_delete = this.instance();
      if (instance_to_delete) {
        winston.info(
          'Deleting instance from backbone db model: ' + this.getLogName());
        this.instance().destroy();
      }

    } else if (method === 'read') {
      if (this.has('id')) {
        this.model()
        .find(this.id)
        .then(_.bind(function(instance) {
          this.set({ instance: instance });
          this.getAssociations(instance).then(_.bind(function() {
            this.trigger('load');
          }, this));
        }, this))
        .catch(function(err) {
          winston.error(
            'Error reading model from database: ' + err.stack);
        });
      } else {
        winston.error(
          'Can\'t read backbone db model because no id is set. Model: ' +
          this.tableName());
      }
    }
  }
});

