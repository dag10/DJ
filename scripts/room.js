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

  window.connection = connection;
});

