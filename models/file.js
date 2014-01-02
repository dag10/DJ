/* file.js
 * File model. Represents a file stored locally.
 */

var orm = require('orm');

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
      getLocalFilename: function() {
        return this.id + '_' + this.filename;
      }
    }
  });

  models.file = File;
};

exports.associate = function(models) {
  File.hasOne('uploader', models.person, {
    reverse: 'files'
  });
};

