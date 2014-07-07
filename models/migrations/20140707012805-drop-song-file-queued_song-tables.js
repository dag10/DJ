/* Migration to drop old song, file, and queued_song tables. */

exports.up = function(migration, DataTypes, done) {
  migration.dropTable('song');
  migration.dropTable('file');
  migration.dropTable('queued_song');
  done();
};

exports.down = function(migration, DataTypes, done) {
  migration.createTable('song', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    source: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    uuid: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    artist: {
      type: DataTypes.STRING
    },
    album: {
      type: DataTypes.STRING
    },
    duration: {
      type: DataTypes.FLOAT,
      allowNull: false
    },
    timeUploaded: {
      type: DataTypes.DATE,
      allowNull: false
    },
    uploader_id: {
      type: DataTypes.INTEGER
    },
    file_id: {
      type: DataTypes.INTEGER
    },
    artwork_id: {
      type: DataTypes.INTEGER
    }
  });

  migration.createTable('file', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    directory: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    timeUploaded: {
      type: DataTypes.DATE,
      allowNull: false
    },
    uploader_id: {
      type: DataTypes.INTEGER
    }
  });

  migration.createTable('queued_song', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    order: {
      type: DataTypes.FLOAT
    },
    user_id: {
      type: DataTypes.INTEGER
    },
    song_id: {
      type: DataTypes.INTEGER
    }
  });

  done();
};

