/* auth.js
 * Authentication functions.
 */

var config = require('../../config');
var util = require('util');
var winston = require('winston');
var sanitizer = require('sanitizer');
var user_model = require('../../models/user');

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

  if (config.auth.method == 'dev') {
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

    user_model.Model.find({
      where: {
        username: session.username
      }
    }).success(function(user) {
      if (user) {
        session.id = user.id;

        // Update last visit time, as well as first+last+full names.
        user.firstName = session.firstName;
        user.lastName = session.lastName;
        user.fullName = session.fullName;
        user.lastVisitedAt = new Date();
        user
        .save()
        .success(callback)
        .error(function(err) {
          next(new Error(
            'Failed to update user entity.\n\n' + util.format(err)));
        });

      } else { // Must create new user
        user_model.Model.create({
          username: session.username,
          firstName: session.firstName,
          lastName: session.lastName,
          fullName: session.fullName,
          firstVisit: new Date(),
          lastVisit: new Date(),
          admin: config.superadmin == session.username
        })
        .success(function(user) {
          winston.info('Created user ' + user.getLogName());
          callback(user);
        })
        .error(function(err) {
          next(new Error(
            'Failed to create user entry.\n\n' + util.format(err)));
        });
      }
    }).error(next);
  };

  return ret;
}

