'use strict';

/**
 * Podcast agent — Google + YouTube shadow signals.
 * 2-4hr lag. Weight 40%.
 */

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

async function run() {
  let count = 0;
  try {
    const items = await fetchPodcastSignals();
    for (const item of items) {
      await upsertContent(item);
      count++;
    }
  } catch (err) {
    logger.warn('Podcast agent failed', { error: err.message });
  }
  return { count };
}

async function fetchPodcastSignals() {
  const { data } = await axios.get('https://newsapi.org/v2/everything', {
    params: {
      q: 'India podcast trending viral episode',
      language: 'en', sortBy: 'publishedAt', pageSize: 10,
      apiKey: agents.googleNewsApiKey,
    },
    timeout: 10000,
  });
  return (data.articles || []).filter(a => a.title && a.url);
}

async function upsertContent(article) {
  const externalId = `pod_${Buffer.from(article.url).toString('base64').substring(0, 24)}`;
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3600000;
  if (ageHours >= 48) return;

  const existing = await query(`SELECT id FROM content_items WHERE external_id = $1`, [externalId]);
  if (existing.rows.length) return;

  const freshness = ageHours < 12 ? 'rising' : 'viral';
  const ins = await query(
    `INSERT INTO content_items
       (external_id, title, summary_en, canonical_url, platform_sources,
        category, freshness_state, city, geographic_level, first_seen_at, country_code)
     VALUES ($1,$2,$3,$4,$5,'culture',$6,'national','national',NOW(),'IN')
     RETURNING id`,
    [externalId, article.title, article.description || '', article.url,
     JSON.stringify(['podcast_shadow']), freshness]
  );

  await viralScore.calculate({
    id: ins.rows[0].id, city: 'national', category: 'culture',
    platformSources: ['podcast_shadow'],
    views: 0, comments: 0, shares: 0, ageHours,
  });
}

module.exports = { run };
