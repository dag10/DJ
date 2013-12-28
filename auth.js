/* auth.js
 * Authentication functions.
 */

var config = require('./config');

exports.init = function(app) {
  var ret = {};

  if (config.auth.method == 'webauth') {
    // TODO: Implement webauth.
    // https://wiki.csh.rit.edu/wiki/Member_Pages

    console.error('Webauth not implemented.');

    config.logoutUrl = config.auth.webauth.logout_url;

    ret.initHandlers = function() {};

    ret.getUser = function(req, res) {
      res.status(500);
      res.send('Webauth not implemented.');
      return null;
    };

  } else if (config.auth.method == 'dev') {
    config.logoutUrl = '/logout';

    ret.initHandlers = function() {
      app.get('/logout', function(req, res) {
        if (req.session && req.session.user)
          req.session.user = null;
        res.status(302);
        res.setHeader('Location', '/');
        res.end();
      });

      app.get('/login', function(req, res) {
        res.render('login.ejs', {
          config: config
        });
      });

      app.post('/login', function(req, res) {
        var required_fields = ['username', 'first_name', 'last_name'];
        var valid = true;
        console.log(req.body);
        for (var i = 0; i < required_fields.length; i++) {
          var field = required_fields[i];
          if (!req.body || !req.body[field]) {
            res.render('login.ejs', {
              error: 'Missing field: ' + field,
              config: config,
              values: req.body
            });
            valid = false;
            break;
          }
        };

        if (!valid) return;

        req.session.user = {
          username: req.body.username,
          firstName: req.body.first_name,
          lastName: req.body.last_name,
          fullName: req.body.first_name + ' ' + req.body.last_name
        };

        res.status(302);
        res.setHeader('Location', req.session.ret_url || '/');
        res.end();
      });
    }

    ret.getUser = function(req, res) {
      if (!req.session || !req.session.user) {
        req.session.ret_url = req.url;
        res.status(302);
        res.setHeader('Location', '/login');
        res.end();
        return null;
      }

      // TODO: If no user.id, make sure user exists in db, or create them.
      // Also, if they exist, make sure the first+last+full name in the db
      // is up to date.

      return req.session.user;
    };
  }

  return ret;
}

