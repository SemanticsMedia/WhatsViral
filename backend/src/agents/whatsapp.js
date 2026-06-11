'use strict';

/**
 * WhatsApp Submission handler — user-generated content.
 * Real-time. Weight 30% (human verification required before scoring).
 * Submissions arrive via POST /api/v1/content/whatsapp-submit.
 * This agent processes the pending queue: basic spam check → queue for human review.
 */

const { query } = require('../config/database');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

async function run() {
  const pending = await query(
    `SELECT * FROM whatsapp_submissions
     WHERE status = 'pending' AND created_at > NOW() - INTERVAL '24 hours'
     ORDER BY created_at ASC LIMIT 50`
  );

  let processed = 0;
  for (const sub of pending.rows) {
    try {
      await processSubmission(sub);
      processed++;
    } catch (err) {
      logger.warn('WhatsApp submission processing failed', { id: sub.id, error: err.message });
    }
  }

  return { count: processed };
}

async function processSubmission(sub) {
  // Basic spam detection — duplicate content from same source within 1hr
  const dupe = await query(
    `SELECT id FROM whatsapp_submissions
     WHERE submitter_phone_hash = $1
       AND created_at > NOW() - INTERVAL '1 hour'
       AND id != $2
     LIMIT 1`,
    [sub.submitter_phone_hash, sub.id]
  );

  if (dupe.rows.length) {
    await query(
      `UPDATE whatsapp_submissions SET status = 'rejected', reject_reason = 'duplicate' WHERE id = $1`,
      [sub.id]
    );
    return;
  }

  // Mark as awaiting human review — weight 30% until verified
  await query(
    `UPDATE whatsapp_submissions SET status = 'awaiting_review', processed_at = NOW() WHERE id = $1`,
    [sub.id]
  );
}

// Called by admin after human verification
async function verifyAndPublish(submissionId, reviewerId) {
  const result = await query(
    `SELECT * FROM whatsapp_submissions WHERE id = $1`, [submissionId]
  );
  if (!result.rows.length) throw new Error('Submission not found');
  const sub = result.rows[0];

  const ins = await query(
    `INSERT INTO content_items
       (external_id, title, summary_en, platform_sources, category,
        freshness_state, city, geographic_level, first_seen_at, country_code)
     VALUES ($1,$2,$3,$4,'world','breaking',$5,'city',NOW(),'IN')
     RETURNING id`,
    [
      `wa_${sub.id}`,
      sub.content.substring(0, 150),
      sub.content,
      JSON.stringify(['whatsapp']),
      sub.city,
    ]
  );

  await viralScore.calculate({
    id: ins.rows[0].id, city: sub.city, category: 'world',
    platformSources: ['whatsapp'],
    views: 0, comments: 0, shares: 0, ageHours: 0,
  });

  await query(
    `UPDATE whatsapp_submissions
     SET status = 'published', reviewer_id = $1, reviewed_at = NOW(), content_id = $2
     WHERE id = $3`,
    [reviewerId, ins.rows[0].id, sub.id]
  );

  return ins.rows[0].id;
}

module.exports = { run, verifyAndPublish };
