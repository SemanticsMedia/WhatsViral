'use strict';

const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');
const feedComposer = require('../scoring/feedComposer');

// GET /api/v1/feed?city=Nagpur&lang=hi&category=all&cursor=
router.get('/', optionalAuth, async (req, res) => {
  const { city, lang = 'en', category = 'all', cursor } = req.query;
  if (!city) return res.status(400).json({ error: 'city is required' });

  const feed = await feedComposer.compose({
    city,
    lang,
    category,
    cursor,
    userId: req.user?.id,
    deviceId: req.headers['x-device-id'],
  });

  res.json(feed);
});

// POST /api/v1/feed/seen — mark content as seen
router.post('/seen', optionalAuth, async (req, res) => {
  const { contentId, viralScoreAtView, city } = req.body;
  if (!contentId) return res.status(400).json({ error: 'contentId required' });

  const { query } = require('../config/database');
  await query(
    `INSERT INTO seen_content (content_id, user_id, device_id, viral_score_at_view, city)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (content_id, COALESCE(user_id::text,''), COALESCE(device_id,''))
     DO UPDATE SET seen_at = NOW(), viral_score_at_view = $4`,
    [contentId, req.user?.id || null, req.headers['x-device-id'] || null, viralScoreAtView, city]
  );

  res.json({ ok: true });
});

// POST /api/v1/feed/report — misinformation report
router.post('/report', optionalAuth, async (req, res) => {
  const { contentId, reason, detail } = req.body;
  if (!contentId || !reason) return res.status(400).json({ error: 'contentId and reason required' });

  const validReasons = ['false_misleading', 'harmful', 'spam', 'other'];
  if (!validReasons.includes(reason)) return res.status(400).json({ error: 'Invalid reason' });

  const { query } = require('../config/database');
  await query(
    `INSERT INTO content_reports (content_id, reason, detail, reporter_user_id, reporter_device_id, reporter_ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [contentId, reason, detail || null, req.user?.id || null, req.headers['x-device-id'] || null, req.ip]
  );

  res.json({ ok: true });
});

module.exports = router;
