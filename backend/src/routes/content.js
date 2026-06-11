'use strict';

const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');
const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { SHARE_LINK_TTL_HOURS } = require('../config/constants');

// GET /api/v1/content/:id — single content item with current score
router.get('/:id', optionalAuth, async (req, res) => {
  const result = await query(
    `SELECT ci.*,
            vs.score as viral_score,
            vs.calculated_at as score_at,
            au.score as authenticity_score,
            COALESCE(cr.report_count, 0) as report_count
     FROM content_items ci
     JOIN LATERAL (
       SELECT score, calculated_at FROM viral_score_history
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT score FROM authenticity_scores
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) au ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) as report_count FROM content_reports
       WHERE content_id = ci.id
     ) cr ON true
     WHERE ci.id = $1`,
    [req.params.id]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Content not found' });
  res.json(result.rows[0]);
});

// POST /api/v1/content/:id/share — generate share link
router.post('/:id/share', optionalAuth, async (req, res) => {
  const contentResult = await query(
    `SELECT ci.id, ci.title, ci.city, ci.category, ci.platform_sources, ci.canonical_url,
            vs.score as viral_score_snapshot
     FROM content_items ci
     JOIN LATERAL (
       SELECT score FROM viral_score_history
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) vs ON true
     WHERE ci.id = $1`,
    [req.params.id]
  );
  if (!contentResult.rows.length) return res.status(404).json({ error: 'Content not found' });

  const content = contentResult.rows[0];
  const shareId = uuidv4().replace(/-/g, '').substring(0, 12);
  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_HOURS * 3600 * 1000);

  await query(
    `INSERT INTO share_links (share_id, content_id, viral_score_snapshot, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [shareId, content.id, content.viral_score_snapshot, expiresAt]
  );

  res.json({
    shareId,
    shareUrl: `https://whatsviral.in/v/${shareId}`,
    expiresAt,
    card: {
      title: content.title,
      viralScore: content.viral_score_snapshot,
      city: content.city,
      platforms: content.platform_sources,
      category: content.category,
      canonicalUrl: content.canonical_url,
    },
  });
});

// GET /api/v1/content/share/:shareId — resolve share link
router.get('/share/:shareId', async (req, res) => {
  const result = await query(
    `SELECT sl.*, ci.title, ci.city, ci.category, ci.platform_sources, ci.canonical_url
     FROM share_links sl JOIN content_items ci ON ci.id = sl.content_id
     WHERE sl.share_id = $1`,
    [req.params.shareId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Share link not found or expired' });

  const link = result.rows[0];
  if (new Date(link.expires_at) < new Date()) {
    return res.status(410).json({ expired: true, city: link.city });
  }

  res.json(link);
});

// POST /api/v1/content/whatsapp-submit — user WhatsApp submission
router.post('/whatsapp-submit', async (req, res) => {
  const { content, sourceUrl, city, lang, submitterPhone } = req.body;
  if (!content || !city) return res.status(400).json({ error: 'content and city required' });

  await query(
    `INSERT INTO whatsapp_submissions (content, source_url, city, lang, submitter_phone_hash, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [content, sourceUrl || null, city, lang || 'en',
     submitterPhone ? require('crypto').createHash('sha256').update(submitterPhone).digest('hex') : null]
  );

  res.json({ ok: true, message: 'Submission received for review' });
});

module.exports = router;
