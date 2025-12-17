// This file sets up the database

const Database = require('better-sqlite3');
const path = require('path');

// Connect to database file
const dbPath = path.join(__dirname, 'myapp.db');
const db = new Database(dbPath);

// Create tables if they don't exist
// Create users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    displayname TEXT NOT NULL,
    namecolor BLOB NULL,
    icon BLOB NULL,
    theme TEXT NULL,
    bio TEXT NULL,
    failedattempts INTEGER NOT NULL,
    lockoutstatus INTEGER NOT NULL DEFAULT 1
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
    timeposted DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
// Create login attempts table
db.exec(`
  CREATE TABLE IF NOT EXISTS loginattempts (
    username TEXT NOT NULL,
    ip VARBINARY(16) NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status BIT NOT NULL
  )
`);

module.exports = db;
