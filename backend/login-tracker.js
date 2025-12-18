// This module will track and limit login attempts
const db = require('./database');

// Configuration
const MAX_ATTEMPTS = 5;           // Maximum failed attempts allowed
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

// Records a login attempt
function recordAttempt(ipAddress, username, success) {
  const stmt = db.prepare(`
    INSERT INTO login_attempts (ip_address, username, success)
    VALUES (?, ?, ?)
  `);

  stmt.run(ipAddress, username, success ? 1 : 0);
}


// Checks if a username+IP combination is currently locked out

function checkLockout(ipAddress, username) {
  const cutoffTime = Date.now() - LOCKOUT_DURATION;

  // Get all failed attempts for this IP+username combination in the lockout window
  // 'unixepoch' tells SQLite to interpret the number as seconds since Jan 1, 1970
  // We divide Date.now() by 1000 to convert from milliseconds to seconds
  const stmt = db.prepare(`
    SELECT COUNT(*) as count, MAX(attempt_time) as last_attempt
    FROM login_attempts
    WHERE ip_address = ?
      AND username = ?
      AND success = 0
      AND datetime(attempt_time) > datetime(?, 'unixepoch')
  `);

  const result = stmt.get(ipAddress, username, cutoffTime / 1000);

  if (result.count >= MAX_ATTEMPTS) {
    // Calculate remaining lockout time
    const lastAttempt = new Date(result.last_attempt).getTime();
    const lockoutEnds = lastAttempt + LOCKOUT_DURATION;
    const remainingTime = Math.max(0, lockoutEnds - Date.now());

    return {
      locked: true,
      remainingTime: remainingTime,
      attempts: result.count
    };
  }

  return {
    locked: false,
    remainingTime: 0,
    attempts: result.count
  };
}

/*
 Clears old login attempts (cleanup function)
 Removes attempts older than the lockout duration
 */
function cleanupOldAttempts() {
  const cutoffTime = Date.now() - LOCKOUT_DURATION;

  // 'unixepoch' interprets the number as seconds since Unix epoch (Jan 1, 1970)
  const stmt = db.prepare(`
    DELETE FROM login_attempts
    WHERE datetime(attempt_time) < datetime(?, 'unixepoch')
  `);

  const result = stmt.run(cutoffTime / 1000);
  return result.changes;
}

// Clean up old attempts every hour
setInterval(() => {
  const deleted = cleanupOldAttempts();
  if (deleted > 0) {
    console.log(`Cleaned up ${deleted} old login attempt(s)`);
  }
}, 60 * 60 * 1000);

module.exports = {
  recordAttempt,
  checkLockout,
  cleanupOldAttempts
};
