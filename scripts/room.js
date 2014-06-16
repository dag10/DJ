$(function() {
  var connection = new Connection({
    room_shortname: window.room.shortname
  });
  
  if (window.user) {
    connection.set({
      username: user.username,
      userhash: user.hash
    });
  }

  new views.Queue({
    collection: connection.get('queue'),
    connection: connection,
    el: $('#queue-column')[0]
  });

  new views.Search({
    model: new models.SearchResults({
      sections: window.search_sections || []
    }),
    connection: connection,
    el: $('#queue-column')[0]
  });

  connection.on('change:room', function(conn) {
    var room = conn.get('room');
    if (!room) return;

    new views.Room({
      model: room,
      el: $('body')[0]
    });

    new views.Users({
      collection: room.get('djs'),
      el: $('#dj-section')[0]
    });

    new views.Users({
      collection: room.get('listeners'),
      el: $('#listener-section')[0]
    });

    new views.Playback({
      model: room.get('playback'),
      el: $('#playback-container')
    });
  });

  window.connection = connection;
});

