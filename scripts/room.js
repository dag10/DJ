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
  });

  window.connection = connection;
});

