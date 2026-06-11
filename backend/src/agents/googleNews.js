'use strict';

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const { CITIES, PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

const TOPICS = [
  { q: 'India', category: 'world' },
  { q: 'cricket IPL', category: 'sports' },
  { q: 'Bollywood film', category: 'entertainment' },
  { q: 'India tech startup', category: 'tech' },
  { q: 'India politics election', category: 'politics' },
  { q: 'India business economy', category: 'business' },
];

async function run() {
  let count = 0;
  for (const topic of TOPICS) {
    try {
      const articles = await fetchNews(topic.q);
      for (const article of articles) {
        await upsertContent(article, topic.category);
        count++;
      }
    } catch (err) {
      logger.warn('Google News fetch failed', { topic: topic.q, error: err.message });
    }
  }
  return { count };
}

async function fetchNews(q) {
  const url = 'https://newsapi.org/v2/everything';
  const { data } = await axios.get(url, {
    params: {
      q,
      language: 'en',
      sortBy: 'publishedAt',
      pageSize: 20,
      apiKey: agents.googleNewsApiKey,
    },
    timeout: 10000,
  });
  return (data.articles || []).filter(a => a.url && a.title);
}

async function upsertContent(article, category) {
  const externalId = `gnews_${Buffer.from(article.url).toString('base64').substring(0, 32)}`;
  const ageHours = (Date.now() - new Date(article.publishedAt).getTime()) / 3600000;
  const freshness = ageHours < 2 ? 'breaking' : ageHours < 12 ? 'rising' : ageHours < 48 ? 'viral' : 'expired';
  if (freshness === 'expired') return;

  const existing = await query(
    `SELECT id FROM content_items WHERE external_id = $1`, [externalId]
  );

  let contentId;
  if (existing.rows.length) {
    contentId = existing.rows[0].id;
    await query(
      `UPDATE content_items SET freshness_state = $1, updated_at = NOW() WHERE id = $2`,
      [freshness, contentId]
    );
  } else {
    const city = CITIES[Math.floor(Math.random() * CITIES.length)].name;
    const ins = await query(
      `INSERT INTO content_items
         (external_id, title, summary_en, canonical_url, thumbnail_url, platform_sources,
          category, freshness_state, city, geographic_level, first_seen_at, country_code,
          creator_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'national',NOW(),'IN',$10)
       RETURNING id`,
      [
        externalId, article.title, article.description || '', article.url,
        article.urlToImage || null, JSON.stringify([PLATFORMS.GOOGLE_NEWS]),
        category, freshness, city, article.source?.name || '',
      ]
    );
    contentId = ins.rows[0].id;
  }

  await viralScore.calculate({
    id: contentId, city: 'national', category,
    platformSources: [PLATFORMS.GOOGLE_NEWS],
    views: 0, comments: 0, shares: 0, ageHours,
  });
}

module.exports = { run };
