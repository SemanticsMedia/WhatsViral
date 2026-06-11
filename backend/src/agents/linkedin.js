'use strict';

/**
 * LinkedIn agent — shadow signals + enhanced public monitoring.
 * Detection time: 30-60 minutes. Weight: 50%.
 * Sources: Google index of LinkedIn content + public LinkedIn hashtag pages.
 * No LinkedIn API — aggregate topics only, not individual profiles.
 */

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const { PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

const INDUSTRY_HASHTAGS = [
  'indianstartups', 'india', 'indianbusiness', 'tech', 'fintech', 'edtech',
];

async function run() {
  let count = 0;

  // Use Google News API to find recently indexed LinkedIn content
  for (const tag of INDUSTRY_HASHTAGS) {
    try {
      const items = await fetchGoogleIndexedLinkedIn(tag);
      for (const item of items) {
        await upsertContent(item);
        count++;
      }
    } catch (err) {
      logger.warn('LinkedIn shadow fetch failed', { tag, error: err.message });
    }
  }

  return { count };
}

async function fetchGoogleIndexedLinkedIn(hashtag) {
  const { data } = await axios.get('https://newsapi.org/v2/everything', {
    params: {
      q: `site:linkedin.com ${hashtag}`,
      sortBy: 'publishedAt',
      pageSize: 5,
      apiKey: agents.googleNewsApiKey,
    },
    timeout: 10000,
  });
  return (data.articles || []).filter(a => a.url?.includes('linkedin.com'));
}

async function upsertContent(article) {
  const externalId = `li_${Buffer.from(article.url).toString('base64').substring(0, 24)}`;
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3600000;
  const freshness = ageHours < 12 ? 'rising' : ageHours < 48 ? 'viral' : 'expired';
  if (freshness === 'expired') return;

  const existing = await query(`SELECT id FROM content_items WHERE external_id = $1`, [externalId]);
  let contentId;

  if (existing.rows.length) {
    contentId = existing.rows[0].id;
  } else {
    const ins = await query(
      `INSERT INTO content_items
         (external_id, title, summary_en, canonical_url, platform_sources,
          category, freshness_state, city, geographic_level, first_seen_at, country_code, creator_name)
       VALUES ($1,$2,$3,$4,$5,'business',$6,'national','national',NOW(),'IN',$7)
       RETURNING id`,
      [
        externalId, article.title, article.description || '',
        article.url, JSON.stringify([PLATFORMS.LINKEDIN]),
        freshness, article.source?.name || '',
      ]
    );
    contentId = ins.rows[0].id;
  }

  await viralScore.calculate({
    id: contentId, city: 'national', category: 'business',
    platformSources: [PLATFORMS.LINKEDIN],
    views: 0, comments: 0, shares: 0, ageHours,
  });
}

module.exports = { run };
