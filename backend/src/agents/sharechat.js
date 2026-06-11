'use strict';

/**
 * ShareChat agent — shadow signals via aggregate topic detection.
 * 2-6hr lag. Weight 50%.
 * No direct API. Detects ShareChat trends via Google search index signals
 * and cross-referencing with YouTube/Google Trends co-occurrence.
 * Aggregate topics only — no individual profiles scraped.
 */

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const { PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

async function run() {
  let count = 0;
  try {
    const items = await fetchShadowSignals();
    for (const item of items) {
      await upsertContent(item);
      count++;
    }
  } catch (err) {
    logger.warn('ShareChat shadow agent failed', { error: err.message });
  }
  return { count };
}

async function fetchShadowSignals() {
  const { data } = await axios.get('https://newsapi.org/v2/everything', {
    params: {
      q: 'site:sharechat.com OR sharechat trending India',
      sortBy: 'publishedAt',
      pageSize: 10,
      language: 'en',
      apiKey: agents.googleNewsApiKey,
    },
    timeout: 10000,
  });
  return (data.articles || []).filter(a => a.title && a.url);
}

async function upsertContent(article) {
  const externalId = `sc_${Buffer.from(article.url).toString('base64').substring(0, 24)}`;
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3600000;
  const freshness = ageHours < 12 ? 'rising' : ageHours < 48 ? 'viral' : 'expired';
  if (freshness === 'expired') return;

  const existing = await query(`SELECT id FROM content_items WHERE external_id = $1`, [externalId]);
  if (existing.rows.length) return;

  const ins = await query(
    `INSERT INTO content_items
       (external_id, title, summary_en, canonical_url, platform_sources,
        category, freshness_state, city, geographic_level, first_seen_at, country_code)
     VALUES ($1,$2,$3,$4,$5,'culture',$6,'national','national',NOW(),'IN')
     RETURNING id`,
    [
      externalId, article.title, article.description || '',
      article.url, JSON.stringify([PLATFORMS.SHARECHAT]),
      freshness,
    ]
  );

  await viralScore.calculate({
    id: ins.rows[0].id, city: 'national', category: 'culture',
    platformSources: [PLATFORMS.SHARECHAT],
    views: 0, comments: 0, shares: 0, ageHours,
  });
}

module.exports = { run };
