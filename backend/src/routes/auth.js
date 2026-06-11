'use strict';

const router = require('express').Router();
const jwt = require('jsonwebtoken');
const { auth } = require('../config/env');
const { query } = require('../config/database');

// POST /api/v1/auth/google — exchange Google OAuth token
router.post('/google', async (req, res) => {
  const { idToken, city, lang } = req.body;
  if (!idToken) return res.status(400).json({ error: 'idToken required' });

  // Verify Google token — implementation uses google-auth-library
  // Stub: full OAuth verification wired in Phase 2
  res.status(501).json({ error: 'Google OAuth not yet configured' });
});

// POST /api/v1/auth/apple — exchange Apple Sign In token
router.post('/apple', async (req, res) => {
  const { identityToken, city, lang } = req.body;
  if (!identityToken) return res.status(400).json({ error: 'identityToken required' });

  res.status(501).json({ error: 'Apple Sign In not yet configured' });
});

// DELETE /api/v1/auth/account — one-tap account deletion
router.delete('/account', require('../middleware/auth').authenticate, async (req, res) => {
  const { id } = req.user;
  await query(
    `UPDATE users SET deleted_at = NOW(), email = NULL, display_name = NULL
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  await query('DELETE FROM seen_content WHERE user_id = $1', [id]);
  await query('DELETE FROM saved_creators WHERE user_id = $1', [id]);
  await query('DELETE FROM user_sessions WHERE user_id = $1', [id]);
  res.json({ ok: true, message: 'Account deleted. Anonymised aggregate data retained per privacy policy.' });
});

module.exports = router;
