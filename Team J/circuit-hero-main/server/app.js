const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const path = require('path');
const { createDatabase } = require('./db');

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || null
  };
}

function progressRowToApi(row) {
  return {
    levelId: row.level_id,
    completed: row.completed === 1,
    stars: row.best_stars,
    bestTime: row.best_time_seconds,
    usedHint: row.used_hint_on_best === 1
  };
}

function parseCookies(header) {
  if (!header) return {};
  return header.split(';').reduce(function(cookies, item) {
    const index = item.indexOf('=');
    if (index === -1) return cookies;
    const key = item.slice(0, index).trim();
    const value = item.slice(index + 1).trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function createApp(options = {}) {
  const app = express();
  const db = createDatabase(options.dbPath);
  const sessions = new Map();

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..')));

  function findUserById(id) {
    return db.prepare('SELECT id, username, email FROM users WHERE id = ?').get(id);
  }

  function setSession(res, userId) {
    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, userId);
    res.setHeader('set-cookie', `ch_session=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Lax; Path=/`);
  }

  function auth(req, res, next) {
    const cookies = parseCookies(req.headers.cookie);
    const userId = cookies.ch_session ? sessions.get(cookies.ch_session) : null;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = findUserById(userId);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    req.user = user;
    next();
  }

  app.post('/api/auth/register', function(req, res) {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim() || null;
    const password = String(req.body.password || '');

    if (!username || !password) {
      res.status(400).json({ error: 'Username and password are required' });
      return;
    }

    const now = new Date().toISOString();
    const passwordHash = bcrypt.hashSync(password, 10);

    try {
      const result = db.prepare(`
        INSERT INTO users (username, email, password_hash, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(username, email, passwordHash, now, now);

      const user = findUserById(result.lastInsertRowid);
      setSession(res, user.id);
      res.status(201).json({ user: publicUser(user) });
    } catch (error) {
      if (String(error.message).includes('UNIQUE')) {
        res.status(409).json({ error: 'Username or email already exists' });
        return;
      }
      throw error;
    }
  });

  app.post('/api/auth/login', function(req, res) {
    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    setSession(res, user.id);
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', function(req, res) {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.ch_session) sessions.delete(cookies.ch_session);
    res.setHeader('set-cookie', 'ch_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.status(204).send();
  });

  app.get('/api/me', auth, function(req, res) {
    res.json({ user: publicUser(req.user) });
  });

  app.get('/api/progress', auth, function(req, res) {
    const rows = db.prepare(`
      SELECT level_id, completed, best_stars, best_time_seconds, used_hint_on_best
      FROM level_progress
      WHERE user_id = ?
      ORDER BY level_id
    `).all(req.user.id);

    const levels = {};
    rows.forEach(function(row) {
      const progress = progressRowToApi(row);
      levels[progress.levelId] = {
        completed: progress.completed,
        stars: progress.stars,
        bestTime: progress.bestTime,
        usedHint: progress.usedHint
      };
    });

    res.json({ levels });
  });

  app.post('/api/progress', auth, function(req, res) {
    const levelId = String(req.body.levelId || '').trim();
    const stars = Number(req.body.stars || 1);
    const elapsed = Number(req.body.elapsed || 0);
    const usedHint = !!req.body.usedHint;

    if (!levelId || !Number.isFinite(stars) || stars < 1 || stars > 3 || !Number.isFinite(elapsed) || elapsed < 0) {
      res.status(400).json({ error: 'Invalid progress payload' });
      return;
    }

    const current = db.prepare(`
      SELECT *
      FROM level_progress
      WHERE user_id = ? AND level_id = ?
    `).get(req.user.id, levelId);

    const now = new Date().toISOString();
    const nextStars = current ? Math.max(current.best_stars, stars) : stars;
    const nextBestTime = current && current.best_time_seconds !== null
      ? Math.min(current.best_time_seconds, elapsed)
      : elapsed;

    let nextUsedHint = usedHint;
    if (current) {
      const improvesStars = stars > current.best_stars;
      const improvesTime = current.best_time_seconds === null || elapsed < current.best_time_seconds;
      nextUsedHint = improvesStars || improvesTime ? usedHint : current.used_hint_on_best === 1;
    }

    db.prepare(`
      INSERT INTO level_progress (
        user_id, level_id, completed, best_stars, best_time_seconds,
        used_hint_on_best, completed_at, updated_at
      )
      VALUES (?, ?, 1, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, level_id) DO UPDATE SET
        completed = 1,
        best_stars = excluded.best_stars,
        best_time_seconds = excluded.best_time_seconds,
        used_hint_on_best = excluded.used_hint_on_best,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at
    `).run(req.user.id, levelId, nextStars, nextBestTime, nextUsedHint ? 1 : 0, now, now);

    const row = db.prepare(`
      SELECT level_id, completed, best_stars, best_time_seconds, used_hint_on_best
      FROM level_progress
      WHERE user_id = ? AND level_id = ?
    `).get(req.user.id, levelId);

    res.json(progressRowToApi(row));
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
