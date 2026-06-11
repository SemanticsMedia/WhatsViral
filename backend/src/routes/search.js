'use strict';

const router = require('express').Router();
const { optionalAuth } = require('../middleware/auth');
const { query } = require('../config/database');

// GET /api/v1/search?q=IPL&city=Nagpur&lang=en&from=&to=
router.get('/', optionalAuth, async (req, res) => {
  const { q, city, lang = 'en', from, to, limit = 30, offset = 0 } = req.query;
  if (!q || q.trim().length < 2) return res.status(400).json({ error: 'Query too short' });

  const result = await query(
    `SELECT ci.*, vs.score as viral_score
     FROM content_items ci
     JOIN LATERAL (
       SELECT score FROM viral_score_history
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) vs ON true
     WHERE (ci.title ILIKE $1 OR ci.summary ILIKE $1)
       AND ($2::text IS NULL OR ci.city = $2)
       AND ($3::timestamptz IS NULL OR ci.first_seen_at >= $3)
       AND ($4::timestamptz IS NULL OR ci.first_seen_at <= $4)
       AND ci.freshness_state != 'expired'
     ORDER BY vs.score DESC
     LIMIT $5 OFFSET $6`,
    [`%${q.trim()}%`, city || null, from || null, to || null, Math.min(limit, 100), offset]
  );

  res.json({ items: result.rows, query: q, city, total: result.rowCount });
});

module.exports = router;
