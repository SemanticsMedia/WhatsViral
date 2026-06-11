'use strict';

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/v1/users/me
router.get('/me', authenticate, async (req, res) => {
  const result = await query(
    `SELECT id, display_name, city, lang, account_type, created_at
     FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [req.user.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

// PATCH /api/v1/users/me — update city / language preference
router.patch('/me', authenticate, async (req, res) => {
  const { city, lang } = req.body;
  await query(
    `UPDATE users SET city = COALESCE($1, city), lang = COALESCE($2, lang), updated_at = NOW()
     WHERE id = $3`,
    [city || null, lang || null, req.user.id]
  );
  res.json({ ok: true });
});

// GET /api/v1/users/saved-creators
router.get('/saved-creators', authenticate, async (req, res) => {
  const result = await query(
    `SELECT c.* FROM creators c
     JOIN saved_creators sc ON sc.creator_id = c.id
     WHERE sc.user_id = $1 ORDER BY sc.saved_at DESC`,
    [req.user.id]
  );
  res.json({ creators: result.rows });
});

// POST /api/v1/users/saved-creators/:creatorId
router.post('/saved-creators/:creatorId', authenticate, async (req, res) => {
  await query(
    `INSERT INTO saved_creators (user_id, creator_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.user.id, req.params.creatorId]
  );
  res.json({ ok: true });
});

// DELETE /api/v1/users/saved-creators/:creatorId
router.delete('/saved-creators/:creatorId', authenticate, async (req, res) => {
  await query(
    `DELETE FROM saved_creators WHERE user_id = $1 AND creator_id = $2`,
    [req.user.id, req.params.creatorId]
  );
  res.json({ ok: true });
});

module.exports = router;
