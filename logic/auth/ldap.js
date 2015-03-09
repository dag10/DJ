/* auth/ldap.js
 * LDAP authentication method.
 */
/*jshint es5: true */

var Q = require('q');
var config = require('../../config.js');
var ldap = require('ldapjs');
var sanitizer = require('sanitizer');
var user_model = require('../../models/user');
var winston = require('winston');
var util = require('util');

/** Login url route. */
var login_url = '/login';

/** Logout url route. */
var logout_url = '/logout';

/**
 * Initializes dev auth method.
 *
 * @return Promise resolving when initialized.
 */
exports.init = function() {
  return Q();
};

/**
 * Authenticates against an LDAP server, returning info for the user.
 *
 * @param username Username of user.
 * @param password Password of user.
 * @return Promise resolving with an object of user info or rejecting.
 */
function auth(username, password) {
  var deferred = Q.defer();

  var dn = config.auth.ldap.dnFormat.replace('%username%', username);

  var client = ldap.createClient({
    url: config.auth.ldap.baseURL + '/' + config.auth.ldap.dnBase
  });

  var ldapAttrs = Object.keys(config.auth.ldap.attributes).map(function(key) {
    return config.auth.ldap.attributes[key];
  });

  var opts = {
    filter: config.auth.ldap.filter.replace('%username%', username),
    scope: 'sub',
    attributes: ldapAttrs,
  };

  client.bind(dn, password, function(err) {
    if (err) {
      deferred.reject(err);
      return;
    }

    client.search(config.auth.ldap.dnBase, opts, function(err, search) {
      if (err) {
        deferred.reject(err);
        return;
      }

      var resolved = false;

      search.on('searchEntry', function(entry) {
        if (resolved) return;
        resolved = true;

        var attrs = {};

        entry.attributes.forEach(function(attr) {
          attrs[attr.type] = attr.vals[0];
        });

        var user = {};

        Object.keys(config.auth.ldap.attributes).forEach(function(userAttr) {
          user[userAttr] = attrs[config.auth.ldap.attributes[userAttr]];
        });

        deferred.resolve(user);
      });

      search.on('error', function(err) {
        deferred.reject(err);
      });
    });
  });

  var promise = deferred.promise;
  promise.finally(function() {
    client.unbind(function(err) {
      if (err) {
        winston.error(
          'Error unbinding LDAP: ' + err.name + ': ' + err.message);
      }
    });
  });

  return promise;
}

/**
 * If no ret_url is set for the request, set it to its referer or index.
 *
 * @param req Express request object.
 */
function setReturnUrl(req) {
  if (!req.session.ret_url) {
    req.session.ret_url = req.header('Referer') || '/';
  }
}

/**
 * Clears a session's return url.
 *
 * @param req Express request object.
 */
function clearReturnUrl(req) {
  if (req.session) {
    req.session.ret_url = null;
  }
}

/**
 * Redirects a request to a specific url.
 *
 * @param req Express request object.
 * @param res Express response object.
 * @param url String of url to redirect to.
 */
function redirect(req, res, url) {
  res.status(302);
  res.setHeader('Location', url);
  res.end();
}

/**
 * Returns a request to its referer (previous page), or the root page.
 *
 * @param req Express request object.
 * @param res Express response object.
 */
function returnToReferer(req, res) {
  redirect(req, res, req.header('Referer') || '/');
}

/**
 * Returns a request to its session's ret_url (if any).
 *
 * @param req Express request object.
 * @param res Express response object.
 */
function returnToRetUrl(req, res) {
  var ret_url = req.session.ret_url || '/';
  clearReturnUrl(req);
  redirect(req, res, ret_url);
}

/**
 * Gets the user info from a session.
 *
 * @param req Express request object.
 * @param res Express response object.
 * @return User info object or null if not logged in.
 */
function getSessionUserInfo(req, res) {
  return req.session ? (req.session.user || null) : null;
}

/**
 * Checks to see if a request is logged in.
 *
 * @param req Express request object.
 * @param res Express response object.
 * @return True if user is logged in.
 */
function isLoggedIn(req, res) {
  return !!getSessionUserInfo(req, res);
}

/**
 * Gets the user object from an Express request session.
 *
 * @param req Express request object.
 * @param res Express response object.
 * @return Promise resolving with User object or null.
 */
exports.getSessionUser = function(req, res) {
  var user_info = getSessionUserInfo(req, res);
  if (!user_info) return Q(null);

  var deferred = Q.defer();

  user_model.Model.find({
    where: {
      username: user_info.username
    }
  }).success(function(user) {
    if (user) {
      user_info.id = user.id;

      user.firstName = user_info.firstName;
      user.lastName = user_info.lastName;
      user.fullName = user_info.fullName;

      user.lastVisitedAt = new Date();
      user.admin = user.admin || (config.superadmin == user_info.username);

      user
      .save()
      .success(function() {
        deferred.resolve(user);
      })
      .error(function(err) {
        winston.error('Failed to update user entity: ' + util.format(err));
        deferred.resolve(null);
      });

    } else { // Must create new user

      user_model.Model.create({
        username: user_info.username,
        firstName: user_info.firstName,
        lastName: user_info.lastName,
        fullName: user_info.fullName,
        lastVisitedAt: new Date(),
        firstVisit: new Date(),
        lastVisit: new Date(),
        admin: config.superadmin == user_info.username
      })
      .success(function(user) {
        winston.info('Created user ' + user.getLogName());
        deferred.resolve(user);
      })
      .error(function(err) {
        winston.error('Failed to create user entity: ' + util.format(err));
        deferred.resolve(null);
      });

    }
  }).error(deferred.reject);

  return deferred.promise;
};

/**
 * Handles a login get request.
 *
 * @param render Function to render a response.
 * @param req Express request object.
 * @param res Express response object.
 */
function handleLoginGetRequest(render, req, res) {
  if (isLoggedIn(req, res)) {
    returnToReferer(req, res);
    return;
  }

  setReturnUrl(req);

  render(res, 'login.ejs', {
    hide_login: true
  });
}

/**
 * Handles a login post request.
 *
 * This function sanitizes the user data.
 *
 * @param render Function to render a response.
 * @param req Express request object.
 * @param res Express response object.
 */
function handleLoginPostRequest(render, req, res) {
  var required_fields = ['username', 'password'];

  for (var i = 0; i < required_fields.length; i++) {
    var field = required_fields[i];

    if (!req.body || !req.body[field]) {
      render(res, 'login.ejs', {
        error: 'Missing field: ' + field,
        values: req.body,
        hide_login: true
      });
      return;
    }
  }

  var username = sanitizer.escape(req.body.username);
  var password = sanitizer.escape(req.body.password);

  auth(username, password)
  .then(function(user) {
    var cleanuser = {
      username: sanitizer.escape(user.username),
      firstName: sanitizer.escape(user.firstName),
      lastName: sanitizer.escape(user.lastName),
    };

    if (config.auth.ldap.strictFullName) {
      cleanuser.fullName = user.firstName + ' ' + user.lastName;
    } else {
      cleanuser.fullName = user.fullName;
    }

    req.session.user = cleanuser;
    returnToRetUrl(req, res);
  })
  .catch(function(err) {
    var msg = 'Invalid credentials.';

    if (err.name !== 'InvalidCredentialsError') {
      msg = 'An error occured with LDAP.';
      winston.error('Error with LDAP authentication: ' + err.stack);
    }

    render(res, 'login.ejs', {
      error: msg,
      values: req.body,
      hide_login: true
    });
  });
}

/**
 * Handles a logout get request.
 *
 * @param req Express request object.
 * @param res Express response object.
 */
function handleLogoutGetRequest(req, res) {
  if (req.session && req.session.user) {
    req.session.user = null;
  }

  returnToReferer(req, res);
}

/**
 * Defines web handlers (if any).
 *
 * @param express_app Express app object.
 * @param render Function to render a page.
 * @return Object containing keys login_url and logout_url.
 */
exports.createWebHandlers = function(express_app, render) {
  express_app.get(login_url, handleLoginGetRequest.bind(null, render));
  express_app.post(login_url, handleLoginPostRequest.bind(null, render));
  express_app.get(logout_url, handleLogoutGetRequest);

  return {
    login_url: login_url,
    logout_url: logout_url,
  };
};

