/**
 * Authentication and Authorization Middleware
 * Event & Venue Booking Management System
 */

// Check if the user is logged in
const ensureAuthenticated = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error_msg', 'Please sign in to access this page');
  res.redirect('/auth/login');
};

// Check if the user has one of the allowed roles
const ensureRole = (roles) => {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      req.flash('error_msg', 'Please log in to continue');
      return res.redirect('/auth/login');
    }

    const allowed = Array.isArray(roles) ? roles : [roles];

    if (allowed.includes(req.session.user.role)) {
      return next();
    }

    req.flash('error_msg', `Access denied: Requires ${allowed.join(' or ')} privileges`);
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/organiser/dashboard');
    }
  };
};

// Check if the user is already logged in (for login/register pages)
const ensureGuest = (req, res, next) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/organiser/dashboard');
  }
  next();
};

module.exports = {
  ensureAuthenticated,
  ensureRole,
  ensureGuest
};
