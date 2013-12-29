/* auth.js
 * Authentication functions.
 */

var config = require('./config');
var util = require('util');
var winston = require('winston');

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

      if (missing_headers.length) {
        req.session.user = null;
        throw new Error(
            'Missing webauth headers: ' + missing_headers + '\n\nHeaders: ' +
            util.format(req.headers));
      }

      if (!req.session.user)
        req.session.user = {};

      req.session.user.username = req.headers[webauth_headers.username];
      req.session.user.firstName = req.headers[webauth_headers.firstname];
      req.session.user.lastName = req.headers[webauth_headers.lastname];
      req.session.user.fullName = req.headers[webauth_headers.fullname];

      return req.session.user;
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

  ret.getUser = function(req, res, next, callback) {
    var session;
    try {
      session = ret.getUserSession(req, res);
    } catch (err) {
      next(err);
      return;
    }

    if (!session) return; // No session, but the active auth should have
                          // handled the response.

    req.models.user.find(
        { username: session.username }, 1, function(err, users) {
      if (err) {
        next(err);
        return;
      }

      if (users.length == 1) { // User exists
        var user = users[0];
        session.id = user.id;

        // Update last visit time, as well as first+last+full names.
        user.firstName = session.firstName;
        user.lastName = session.lastName;
        user.fullName = session.fullName;
        user.lastVisit = Date.now();
        user.save(function(err) {
          if (err) {
            next(new Error(
                'Failed to update user entity.\n\n' + util.format(err)));
            return;
          } else {
            callback(user);
            return;
          }
        });
      } else { // Must create new user
        var user = new req.models.user({
          username: session.username,
          firstName: session.firstName,
          lastName: session.lastName,
          fullName: session.fullName,
          firstVisit: Date.now(),
          lastVisit: Date.now(),
          admin: config.superadmin == session.username
        });
        user.save(function(err) {
          if (err) {
            next(new Error(
                'Failed to create user entry.\n\n' + util.format(err)));
            return;
          } else {
            winston.info(
                'Created user ' + user.id + ' (' + user.username + ')');
            callback(user);
            return;
          }
        });
      }
    });
  };

  return ret;
}

