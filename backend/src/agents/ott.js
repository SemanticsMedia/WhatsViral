'use strict';

/**
 * OTT Signal agent — cross-platform shadow signals.
 * Sources: YouTube (trailer/review spikes) + Reddit + Google News.
 * 2-4hr lag. Weight 40%.
 */

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const { PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

const OTT_QUERIES = [
  'Netflix India new release', 'Amazon Prime India new show',
  'Disney Hotstar India', 'JioCinema India streaming',
  'SonyLIV new series India',
];

async function run() {
  let count = 0;
  for (const q of OTT_QUERIES) {
    try {
      const items = await fetchOTTSignals(q);
      for (const item of items) {
        await upsertContent(item);
        count++;
      }
    } catch (err) {
      logger.warn('OTT agent failed', { q, error: err.message });
    }
  }
  return { count };
}

async function fetchOTTSignals(q) {
  const { data } = await axios.get('https://newsapi.org/v2/everything', {
    params: { q, language: 'en', sortBy: 'publishedAt', pageSize: 5, apiKey: agents.googleNewsApiKey },
    timeout: 10000,
  });
  return (data.articles || []).filter(a => a.title && a.url);
}

async function upsertContent(article) {
  const externalId = `ott_${Buffer.from(article.url).toString('base64').substring(0, 24)}`;
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3600000;
  if (ageHours >= 48) return;

  const existing = await query(`SELECT id FROM content_items WHERE external_id = $1`, [externalId]);
  if (existing.rows.length) return;

  const freshness = ageHours < 2 ? 'breaking' : ageHours < 12 ? 'rising' : 'viral';
  const ins = await query(
    `INSERT INTO content_items
       (external_id, title, summary_en, canonical_url, platform_sources,
        category, freshness_state, city, geographic_level, first_seen_at, country_code)
     VALUES ($1,$2,$3,$4,$5,'entertainment',$6,'national','national',NOW(),'IN')
     RETURNING id`,
    [externalId, article.title, article.description || '', article.url,
     JSON.stringify(['ott_shadow']), freshness]
  );

  await viralScore.calculate({
    id: ins.rows[0].id, city: 'national', category: 'entertainment',
    platformSources: ['ott_shadow'],
    views: 0, comments: 0, shares: 0, ageHours,
  });
}

module.exports = { run };
