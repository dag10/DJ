/* file.js
 * File model. Represents a file stored locally.
 */

var orm = require('orm');
var fs_ = require('../fs');

var File;

exports.define = function(db, models) {
  File = db.define('file', {
    directory: {
      type: 'text', required: true },
    filename: {
      type: 'text', required: true },
    timeUploaded: {
      type: 'date', required: true }
  }, {
    validations: {
      filename_local: orm.enforce.unique({ ignoreCase: true })
    },
    methods: {
      getLogName: function() {
        return this.directory + '/' + this.filename + ' (' + this.id + ')';
      }
    },
    hooks: {
      beforeRemove: function() {
        fs_.unlink(
            upload.upload_dir + '/' + this.directory + '/' + this.filename);
      }
    }
  });

  exports.File = models.file = File;
};

exports.associate = function(models) {
  File.hasOne('uploader', models.person, {
    reverse: 'files'
  });
};

