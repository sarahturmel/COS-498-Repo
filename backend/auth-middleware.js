// Module to make sure that the user is not locked out
const loginTracker = require('./login-tracker');

/*
 Middleware to check if user is authenticated
 Returns 401 if not authenticated
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.username) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
}

/**
 Middleware to check username+IP-based login lockout
 Should be used before login route handlers
 Note: This requires the username to be in req.body.username
 */
function checkLoginLockout(req, res, next) {
  const ipAddress = getClientIP(req);
  const username = req.body?.username;

  // If no username provided, skip lockout check (will be handled by validation)
  if (!username) {
    return next();
  }

  const lockoutStatus = loginTracker.checkLockout(ipAddress, username);

  if (lockoutStatus.locked) {
    const minutesRemaining = Math.ceil(lockoutStatus.remainingTime / (60 * 1000));
    return res.status(429).json({
      error: 'Too many failed login attempts',
      message: `Too many failed attempts for this username. Please try again in ${minutesRemaining} minute(s).`,
      remainingTime: lockoutStatus.remainingTime
    });
  }

  next();
}

/**
 Helper function to get client IP address
 Handles proxies and various connection types
 */
function getClientIP(req) {
  return req.ip ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.connection.remoteAddress ||
         'unknown';
}

module.exports = {
  requireAuth,
  checkLoginLockout,
  getClientIP
};
