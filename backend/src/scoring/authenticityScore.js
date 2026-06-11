'use strict';

const { query } = require('../config/database');

/**
 * Authenticity Score — detects manufactured virality.
 * Fires when 3+ trigger conditions are simultaneously true.
 * No single platform sees what WV sees — this is a core moat.
 */
async function calculate(contentItem) {
  const triggers = detectTriggers(contentItem);
  const triggeredCount = Object.values(triggers).filter(Boolean).length;

  let score = 100;
  let label = 'organic';

  if (triggeredCount >= 5) { score = 20; label = 'likely_coordinated'; }
  else if (triggeredCount >= 4) { score = 40; label = 'possibly_coordinated'; }
  else if (triggeredCount >= 3) { score = 65; label = 'unusual_pattern'; }

  const seemsPromoted = triggeredCount >= 3;

  await query(
    `INSERT INTO authenticity_scores
       (content_id, score, label, triggers, seems_promoted)
     VALUES ($1, $2, $3, $4, $5)`,
    [contentItem.id, score, label, JSON.stringify(triggers), seemsPromoted]
  );

  return { score, label, triggers, seemsPromoted };
}

function detectTriggers(item) {
  return {
    velocityAnomaly:          detectVelocityAnomaly(item),
    engagementRatioAnomaly:   detectEngagementAnomaly(item),
    geographicConcentration:  detectGeoConcentration(item),
    accountPatternAnomaly:    detectAccountAnomaly(item),
    crossPlatformSimultaneity: detectSimultaneity(item),
  };
}

function detectVelocityAnomaly(item) {
  // Spike with no warm-up: views_last_2h >> views_2h_before_that with near-zero base
  const { viewsLast2h = 0, viewsPrev2h = 0, baselineViews = 0 } = item;
  if (baselineViews === 0 && viewsLast2h === 0) return false;
  const ratio = viewsLast2h / Math.max(viewsPrev2h, 1);
  return ratio > 10 && viewsPrev2h < 100;
}

function detectEngagementAnomaly(item) {
  // Views/shares disproportionate to comments — typical of bot engagement
  const { views = 1, shares = 0, comments = 0 } = item;
  if (views < 1000) return false;
  const commentRatio = comments / Math.max(views, 1);
  return commentRatio < 0.0001 && (shares / Math.max(views, 1)) > 0.05;
}

function detectGeoConcentration(item) {
  // Unusual geographic concentration: 80%+ from one small area
  const { cityConcentrationPct = 0 } = item;
  return cityConcentrationPct > 80;
}

function detectAccountAnomaly(item) {
  // New, inactive, or homogeneous accounts driving engagement
  const { newAccountPct = 0, inactiveAccountPct = 0 } = item;
  return (newAccountPct + inactiveAccountPct) > 60;
}

function detectSimultaneity(item) {
  // Appearing across 3+ platforms within a 30-minute window
  const { platformFirstSeenTimes = {} } = item;
  const times = Object.values(platformFirstSeenTimes).map(t => new Date(t).getTime());
  if (times.length < 3) return false;
  const spread = Math.max(...times) - Math.min(...times);
  return spread < 30 * 60 * 1000;
}

module.exports = { calculate };
