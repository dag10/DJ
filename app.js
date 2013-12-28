/* app.js
 * The entry point for the app server.
 */
var config = require('./config');
var express = require('express');
var app = express();

app.get('/', function(req, res) {
  res.send('Welcome to the index!');
});

app.get('/play/:room', function(req, res) {
  res.send('You\'re playing in: ' + req.param('room'));
});

app.get('/listen/:room', function(req, res) {
  res.send('You\'re listening to: ' + req.param('room'));
});

app.listen(config.web.port);
console.log('Server listening on port', config.web.port);

