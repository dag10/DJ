/* auth.js
 * Authentication functions.
 */

var config = require('./config');
var util = require('util');

var webauth_headers = {
  username: 'x-webauth-user',
  firstname: 'x-webauth-ldap-givenname',
  lastname: 'x-webauth-ldap-sn',
  fullname: 'x-webauth-ldap-cn'
};

exports.init = function(app) {
  var ret = {};

  if (config.auth.method == 'webauth') {
    config.logoutUrl = config.auth.webauth.logout_url;

    ret.initHandlers = function() {};

    ret.getUserSession = function(req, res) {
      var missing_headers = [];
      Object.keys(webauth_headers).forEach(function(key) {
        if (!(webauth_headers[key] in req.headers))
          missing_headers.push(webauth_headers[key]);
      });

      if (missing_headers.length)
        throw new Error(
            'Missing webauth headers: ' + missing_headers + '\n\nHeaders: ' +
            util.format(req.headers));

      return {
        username: req.headers[webauth_headers.username],
        firstName: req.headers[webauth_headers.firstname],
        lastName: req.headers[webauth_headers.lastname],
        fullName: req.headers[webauth_headers.fullname]
      };
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

    ret.getUserSession = function(req, res) {
      if (!req.session || !req.session.user) {
        req.session.ret_url = req.url;
        res.status(302);
        res.setHeader('Location', '/login');
        res.end();
        return null;
      }

      return req.session.user;
    };
  }

  ret.getUser = function(req, res) {
    var session = ret.getUserSession(req, res);
    if (!session) return null;

    // TODO: If no user.id, make sure user exists in db, or create them.
    // Also, if they exist, make sure the first+last+full name in the db
    // is up to date.
    
    return session;
  };

  return ret;
}

