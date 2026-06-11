'use strict';

const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { query } = require('../config/database');
const agentRunner = require('../agents');

// Admin routes — owner only (account_type = 'admin')
router.use(authenticate, (req, res, next) => {
  if (req.user?.accountType !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  next();
});

// GET /api/v1/admin/agent-status
router.get('/agent-status', async (_req, res) => {
  res.json({ agents: agentRunner.getStatus() });
});

// POST /api/v1/admin/agent/:name/run — manual trigger
router.post('/agent/:name/run', async (req, res) => {
  const result = await agentRunner.runAgent(req.params.name);
  res.json(result);
});

// GET /api/v1/admin/ai-cost — cost monitoring
router.get('/ai-cost', async (_req, res) => {
  const result = await query(
    `SELECT provider, DATE_TRUNC('day', created_at) as day,
            SUM(tokens_in) as tokens_in, SUM(tokens_out) as tokens_out,
            SUM(estimated_cost_usd) as cost_usd, COUNT(*) as calls
     FROM ai_usage_log
     WHERE created_at > NOW() - INTERVAL '30 days'
     GROUP BY provider, day ORDER BY day DESC, provider`
  );
  res.json({ usage: result.rows });
});

// GET /api/v1/admin/grievances — IT Rules 2021 compliance
router.get('/grievances', async (req, res) => {
  const { status, limit = 50 } = req.query;
  const result = await query(
    `SELECT * FROM grievances
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY created_at DESC LIMIT $2`,
    [status || null, limit]
  );
  res.json({ grievances: result.rows });
});

// PATCH /api/v1/admin/grievances/:id
router.patch('/grievances/:id', async (req, res) => {
  const { status, resolution } = req.body;
  await query(
    `UPDATE grievances SET status = $1, resolution = $2,
      resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE NULL END,
      updated_at = NOW()
     WHERE id = $3`,
    [status, resolution || null, req.params.id]
  );
  res.json({ ok: true });
});

module.exports = router;
