$(function() {
  var socket = io.connect();
  var kicked = false;

  var error = function(err) {
    console.error(err);
    alert('Error: ' + err);
  };

  // Request to join a room.
  var joinRoom = function() {
    socket.emit('room:join', room.shortname, function(data) {
      if (data.error) {
        error(data.error);
      } else {
        alert('You joined the room: ' + data.name);
      }
    });
  };

  // Authenticate with the server if logged in.
  var auth = function(next) {
    if (typeof user !== 'undefined' && user) {
      socket.emit('auth', {
        username: user.username,
        hash: userhash
      }, function(data) {
        if (data.error) {
          error(data.error);
        } else {
          console.log('Authenticated.');
          next();
        }
      });
    } else {
      next();
    }
  };

  // Handle the server kicking us.
  socket.on('kick', function(msg) {
    kicked = true;
    error('Kicked: ' + msg);
  });

  // Handle the server telling us how many anonymous users are connected.
  socket.on('room:num_anonymous', function(num) {
    var s = num == 1 ? '' : 's';
    $('#num-anonymous').text(num + ' Anonymous listener' + s + '.');
  });

  socket.on('error', error);

  socket.on('connect', function() {
    auth(joinRoom);
  });

  socket.on('disconnect', function() {
    if (!kicked)
      error('Socket disconnected.');

    kicked = false;
  });
});

