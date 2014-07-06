/* Migration to create Songs, Files, and QueuedSongs tables. */
/*jshint es5: true */

exports.up = function(migration, DataTypes, done) {
  migration.createTable('Songs', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
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
      type: DataTypes.INTEGER,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    UploaderId: {
      type: DataTypes.INTEGER
    },
    FileId: {
      type: DataTypes.INTEGER
    },
    ArtworkId: {
      type: DataTypes.INTEGER
    }
  });

  migration.createTable('Files', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    directory: {
      type: DataTypes.STRING,
      allowNull: false
    },
    filename: {
      type: DataTypes.STRING,
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    UploaderId: {
      type: DataTypes.INTEGER
    }
  });

  migration.createTable('QueuedSongs', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    UserId: {
      type: DataTypes.INTEGER
    },
    SongId: {
      type: DataTypes.INTEGER
    }
  });

  done();
};

exports.down = function(migration, DataTypes, done) {
  migration.dropTable('Songs');
  migration.dropTable('Files');
  migration.dropTable('QueuedSongs');
  done();
};

