/* app.js
 * The entry point for the app server.
 */

var config = require('./config');
var express = require('express');
var handlers = require('./handlers');

var app = express();
var auth = require('./auth').init(app);

handlers.init(app, auth);

app.listen(config.web.port, function() {
  console.log('Server listening on port', config.web.port);
});

