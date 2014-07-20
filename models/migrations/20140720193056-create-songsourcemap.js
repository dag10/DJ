/* Migration to create SongSourceMap table. */
/*jshint es5: true */

exports.up = function(migration, DataTypes, done) {
  migration.createTable('SongSourceMaps', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    source: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sourceId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    confirmations: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    original: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    SongId: {
      type: DataTypes.INTEGER
    }
  });

  done();
};

exports.down = function(migration, DataTypes, done) {
  migration.dropTable('SongSourceMap');
  done();
};

