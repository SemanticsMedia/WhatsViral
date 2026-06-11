'use strict';

const { VIRAL_SCORE_WEIGHTS, VIRAL_SCORE_DECAY, AGENT_WEIGHTS } = require('../config/constants');
const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Calculate ViralScore for a content item.
 * Weights are read from viral_score_weights table (city/category overrides) with
 * global defaults as fallback — this is the dynamic weight learning moat layer.
 */
async function calculate(contentItem, options = {}) {
  const { city, category } = contentItem;

  const weights = await getWeights(city, category);

  const signals = {
    crossPlatformPresence: scoreCrossPlatform(contentItem),
    velocity:              scoreVelocity(contentItem),
    engagementQuality:     scoreEngagement(contentItem),
    geographicSpread:      scoreGeoSpread(contentItem),
    sourceDiversity:       scoreSourceDiversity(contentItem),
    breakoutFactor:        scoreBreakout(contentItem),
  };

  let raw = 0;
  for (const [signal, pts] of Object.entries(signals)) {
    raw += pts * (weights[signal] / VIRAL_SCORE_WEIGHTS[signal]);
  }

  const decay = calcDecay(contentItem.ageHours || 0);
  const final = Math.min(99, Math.max(1, Math.round(raw - decay)));

  if (!options.dryRun) {
    await persistScore(contentItem.id, final, signals, weights, city, category);
  }

  return { score: final, signals, decay };
}

function scoreCrossPlatform(item) {
  const platforms = item.platformSources || [];
  const uniqueAgentWeight = platforms.reduce((sum, p) => sum + (AGENT_WEIGHTS[p] || 0.5), 0);
  return Math.min(VIRAL_SCORE_WEIGHTS.crossPlatformPresence, Math.round(uniqueAgentWeight * 8));
}

function scoreVelocity(item) {
  const { viewsLast2h = 0, viewsLast6h = 1 } = item;
  const accel = viewsLast2h / Math.max(viewsLast6h, 1);
  return Math.min(VIRAL_SCORE_WEIGHTS.velocity, Math.round(accel * VIRAL_SCORE_WEIGHTS.velocity));
}

function scoreEngagement(item) {
  const { comments = 0, shares = 0, views = 1 } = item;
  const ratio = (comments * 3 + shares * 4) / Math.max(views, 1);
  return Math.min(VIRAL_SCORE_WEIGHTS.engagementQuality, Math.round(ratio * 10000));
}

function scoreGeoSpread(item) {
  const cityCount = item.citySpreadCount || 1;
  return Math.min(VIRAL_SCORE_WEIGHTS.geographicSpread, cityCount * 3);
}

function scoreSourceDiversity(item) {
  const categories = new Set((item.platformSources || []).map(p => platformCategory(p)));
  return Math.min(VIRAL_SCORE_WEIGHTS.sourceDiversity, categories.size * 3);
}

function scoreBreakout(item) {
  const { followerCount = 0, engagementRatio = 0 } = item;
  if (followerCount > 100000) return 0;
  return Math.min(VIRAL_SCORE_WEIGHTS.breakoutFactor, Math.round(engagementRatio * 5));
}

function calcDecay(ageHours) {
  if (ageHours >= VIRAL_SCORE_DECAY.expiryHours) return VIRAL_SCORE_DECAY.maxPenalty;
  const ratio = ageHours / VIRAL_SCORE_DECAY.halfLifeHours;
  return Math.round(VIRAL_SCORE_DECAY.maxPenalty * Math.min(1, ratio));
}

function platformCategory(platform) {
  const map = {
    youtube: 'video', tiktok: 'video',
    google: 'search', google_news: 'news',
    instagram: 'social', twitter: 'social', linkedin: 'social',
    telegram: 'messaging', whatsapp: 'messaging',
    reddit: 'forum', sharechat: 'social',
  };
  return map[platform] || 'other';
}

async function getWeights(city, category) {
  try {
    const result = await query(
      `SELECT weights FROM viral_score_weights
       WHERE (city = $1 OR city IS NULL)
         AND (category = $2 OR category IS NULL)
       ORDER BY (city IS NOT NULL)::int + (category IS NOT NULL)::int DESC
       LIMIT 1`,
      [city || null, category || null]
    );
    if (result.rows.length) return { ...VIRAL_SCORE_WEIGHTS, ...result.rows[0].weights };
  } catch (err) {
    logger.warn('Could not load dynamic weights, using defaults', { error: err.message });
  }
  return VIRAL_SCORE_WEIGHTS;
}

async function persistScore(contentId, score, signals, weights, city, category) {
  await query(
    `INSERT INTO viral_score_history
       (content_id, score, signals, weights_used, city, category)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [contentId, score, JSON.stringify(signals), JSON.stringify(weights), city, category]
  );

  await query(
    `UPDATE content_items SET current_viral_score = $1, updated_at = NOW() WHERE id = $2`,
    [score, contentId]
  );
}

module.exports = { calculate, calcDecay };
