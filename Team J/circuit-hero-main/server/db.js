const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function createDatabase(dbPath) {
  const resolvedPath = dbPath || path.join(__dirname, '..', 'data', 'circuit-hero.sqlite');
  const dir = path.dirname(resolvedPath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(resolvedPath);
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS level_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      level_id TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      best_stars INTEGER NOT NULL DEFAULT 0,
      best_time_seconds INTEGER,
      used_hint_on_best INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, level_id)
    );
  `);

  return db;
}

module.exports = { createDatabase };
