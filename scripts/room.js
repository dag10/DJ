$(function() {
  var connection = new Connection({
    room_shortname: window.room.shortname
  });
  
  if (window.user) {
    connection.set({
      username: user.username,
      userhash: userhash
    });
  }

  connection.on('change:room', function(conn) {
    var room = conn.get('room');
    if (!room) return;

    new window.views.Room({
      model: room,
      el: $('body')[0]
    });
  });

  window.connection = connection;
});

