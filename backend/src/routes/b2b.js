'use strict';

const router = require('express').Router();
const { authenticateB2B } = require('../middleware/auth');
const { query } = require('../config/database');

// All B2B routes require B2B account authentication
router.use(authenticateB2B);

// GET /api/v1/b2b/brand-pulse/:brandId
router.get('/brand-pulse/:brandId', async (req, res) => {
  const result = await query(
    `SELECT be.id, be.name, be.description,
            bm.viral_score, bm.velocity_24h, bm.city_spread, bm.platform_breakdown,
            bm.organic_pct, bm.coordinated_pct, bm.sentiment_summary,
            bm.calculated_at
     FROM brand_entities be
     JOIN LATERAL (
       SELECT * FROM brand_metrics
       WHERE brand_id = be.id ORDER BY calculated_at DESC LIMIT 1
     ) bm ON true
     WHERE be.id = $1`,
    [req.params.brandId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'Brand not found' });
  res.json(result.rows[0]);
});

// GET /api/v1/b2b/crisis-radar/:brandId
router.get('/crisis-radar/:brandId', async (req, res) => {
  const result = await query(
    `SELECT ba.*, be.name as brand_name
     FROM brand_alerts ba
     JOIN brand_entities be ON be.id = ba.brand_id
     WHERE ba.brand_id = $1
       AND ba.created_at > NOW() - INTERVAL '48 hours'
     ORDER BY ba.severity DESC, ba.created_at DESC
     LIMIT 20`,
    [req.params.brandId]
  );
  res.json({ alerts: result.rows });
});

// GET /api/v1/b2b/creator-intelligence?city=Nagpur&category=sports
router.get('/creator-intelligence', async (req, res) => {
  const { city, category, limit = 20 } = req.query;
  const result = await query(
    `SELECT c.*, cp.viral_count, cp.organic_score, cp.authenticity_score,
            cp.top_categories, cp.city_spread
     FROM creators c
     JOIN creator_profiles cp ON cp.creator_id = c.id
     WHERE ($1::text IS NULL OR c.primary_city = $1)
       AND ($2::text IS NULL OR $2 = ANY(cp.top_categories))
     ORDER BY cp.viral_count DESC
     LIMIT $3`,
    [city || null, category || null, Math.min(limit, 50)]
  );
  res.json({ creators: result.rows });
});

// GET /api/v1/b2b/daily-digest — latest digest for org
router.get('/daily-digest', async (req, res) => {
  const result = await query(
    `SELECT * FROM daily_digests
     WHERE org_id = $1 ORDER BY delivered_at DESC LIMIT 1`,
    [req.user.orgId]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'No digest found' });
  res.json(result.rows[0]);
});

// GET /api/v1/b2b/global-search?q=...&geo=&from=&to=
router.get('/global-search', async (req, res) => {
  const { q, geo, from, to, limit = 30 } = req.query;
  if (!q) return res.status(400).json({ error: 'q required' });

  const result = await query(
    `SELECT ci.*, vs.score as viral_score
     FROM content_items ci
     JOIN LATERAL (
       SELECT score FROM viral_score_history
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) vs ON true
     WHERE (ci.title ILIKE $1 OR ci.summary ILIKE $1)
       AND ($2::text IS NULL OR ci.country_code = $2)
       AND ($3::timestamptz IS NULL OR ci.first_seen_at >= $3)
       AND ($4::timestamptz IS NULL OR ci.first_seen_at <= $4)
     ORDER BY vs.score DESC
     LIMIT $5`,
    [`%${q}%`, geo || null, from || null, to || null, Math.min(limit, 100)]
  );
  res.json({ items: result.rows });
});

module.exports = router;
