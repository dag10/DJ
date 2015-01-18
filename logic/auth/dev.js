/* auth/dev.js
 * Development authentication method.
 */
/*jshint es5: true */

var Q = require('q');
var config = require('../../config.js');
var sanitizer = require('sanitizer');
var user_model = require('../../models/user');

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
        deferred.reject(new Error(
          'Failed to update user entity.\n\n' + util.format(err)));
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
        deferred.reject(new Error(
          'Failed to create user entry.\n\n' + util.format(err)));
      });

    }
  }).error(deferred.reject);

  return deferred.promise;
};

/**
 * Handles a login get request.
 *
 * @param req Express request object.
 * @param res Express response object.
 */
function handleLoginGetRequest(req, res) {
  if (isLoggedIn(req, res)) {
    returnToReferer(req, res);
    return;
  }

  setReturnUrl(req);

  res.render('login.ejs', {
    config: config,
    hide_login: true
  });
}

/**
 * Handles a login post request.
 *
 * This function sanitizes the user data.
 *
 * @param req Express request object.
 * @param res Express response object.
 */
function handleLoginPostRequest(req, res) {
  var required_fields = ['username', 'first_name', 'last_name'];

  for (var i = 0; i < required_fields.length; i++) {
    var field = required_fields[i];

    if (!req.body || !req.body[field]) {
      res.render('login.ejs', {
        error: 'Missing field: ' + field,
        config: config,
        values: req.body,
        hide_login: true
      });
      return;
    }
  }

  req.session.user = {
    username: sanitizer.escape(req.body.username),
    firstName: sanitizer.escape(req.body.first_name),
    lastName: sanitizer.escape(req.body.last_name),
    fullName: sanitizer.escape(req.body.first_name + ' ' + req.body.last_name),
  };

  returnToRetUrl(req, res);
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
 * @return Object containing keys login_url and logout_url.
 */
exports.createWebHandlers = function(express_app) {
  express_app.get(login_url, handleLoginGetRequest);
  express_app.post(login_url, handleLoginPostRequest);
  express_app.get(logout_url, handleLogoutGetRequest);

  return {
    login_url: login_url,
    logout_url: logout_url,
  };
};

