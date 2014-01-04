/* auth.js
 * Authentication functions.
 */

var config = require('./config');
var util = require('util');
var winston = require('winston');
var sanitizer = require('sanitizer');

var webauth_headers = {
  username: 'x-webauth-user',
  firstname: 'x-webauth-ldap-givenname',
  lastname: 'x-webauth-ldap-sn',
  fullname: 'x-webauth-ldap-cn'
};

function sanitizeSession(session) {
  session.username = sanitizer.escape(session.username);
  session.firstName = sanitizer.escape(session.firstName);
  session.lastName = sanitizer.escape(session.lastName);
  session.fullName = sanitizer.escape(session.fullName);
}

function returnToReferer(req, res) {
  res.status(302);
  res.setHeader('Location', req.header('Referer') || '/');
  res.end();
}

function returnToUrl(req, res) {
  res.status(302);
  res.setHeader('Location', req.session.ret_url || '/');
  req.session.ret_url = null;
  res.end();
}

exports.init = function(app) {
  var ret = {};

  config.loginUrl = '/login';

  if (config.auth.method == 'webauth') {
    config.logoutUrl = config.auth.webauth.logout_url;

    ret.initHandlers = function() {
      app.get('/webauth', function(req, res) {
        var session = ret.getUserSession(true, req, res);
        if (session)
          returnToUrl(req, res);
      });

      app.get('/login', function(req, res) {
        req.session.ret_url = req.header('Referer');
        res.status(302);
        res.setHeader('Location', '/webauth');
        res.end();
      });
    };

    ret.getUserSession = function(required, req, res) {
      var missing_headers = [];
      Object.keys(webauth_headers).forEach(function(key) {
        if (!(webauth_headers[key] in req.headers))
          missing_headers.push(webauth_headers[key]);
      });

      if (missing_headers.length) {
        req.session.user = null;
        if (!required) return null;
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
        returnToReferer(req, res);
      });

      app.get('/login', function(req, res) {
        if (ret.getUserSession(false, req, res)) {
          returnToReferer(req, res);
        } else {
          if (!req.session.ret_url)
            req.session.ret_url = req.header('Referer') || '/';
          res.render('login.ejs', {
            config: config,
            hide_login: true
          });
        }
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
              values: req.body,
              hide_login: true
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

        returnToUrl(req, res);
      });
    }

    ret.getUserSession = function(required, req, res) {
      if (!req.session || !req.session.user) {
        if (required) {
          req.session.ret_url = req.url;
          res.status(302);
          res.setHeader('Location', '/login');
          res.end();
        }

        return null;
      }

      return req.session.user;
    };
  }

  ret.getUser = function(required, req, res, next, callback) {
    var html = req.accepts('text/html');

    var session;
    try {
      session = ret.getUserSession(required && html, req, res);
    } catch (err) {
      next(err);
      return;
    }

    if (!session) {
      if (!required)
        callback(null);
      else if (!html)
        next(new Error('You must be logged in.'));
      return;
    }

    sanitizeSession(session);

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
        user.lastVisit = new Date();
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
          firstVisit: new Date(),
          lastVisit: new Date(),
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

