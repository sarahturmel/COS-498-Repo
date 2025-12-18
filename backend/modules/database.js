// This file sets up the database

const Database = require('better-sqlite3');
const path = require('path');

// Connect to database file
const dbPath = path.join('/app/data', 'myapp.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables if they don't exist
// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    displayname TEXT NOT NULL,
    namecolor BLOB DEFAULT #000000,
    bio TEXT NULL,
    last_login DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// Create sessions table to store session data
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    username TEXT NOT NULL,
    starttime DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// Create comments table
db.exec(`
  CREATE TABLE IF NOT EXISTS comments (
    author TEXT NOT NULL,
    body TEXT NOT NULL,
    timeposted DATETIME DEFAULT CURRENT_TIMESTAMP,
    color BLOB DEFAULT #000000
  )
`);
// Create login_attempts table for tracking failed login attempts by IP and username
db.exec(`
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT NOT NULL,
    username TEXT NOT NULL,
    attempt_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    success INTEGER DEFAULT 0
  )
`);
// Create index for faster lookups on IP address and username combination
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_username
  ON login_attempts(ip_address, username, attempt_time)
`);

module.exports = db;
