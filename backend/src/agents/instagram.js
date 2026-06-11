'use strict';

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const { CITIES, PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

// Apify actor for Instagram trending hashtags / Reels
// ~1hr lag per spec. Weight 80% in ViralScore.
const APIFY_ACTOR_ID = 'apify~instagram-hashtag-scraper';

const HASHTAGS = [
  'india', 'cricket', 'bollywood', 'trending', 'viral',
  'reels', 'indiatrending', 'news',
];

async function run() {
  let count = 0;
  try {
    const runId = await startApifyRun();
    const items = await pollApifyResults(runId);
    for (const item of items) {
      const city = CITIES[Math.floor(Math.random() * CITIES.length)].name;
      await upsertContent(item, city);
      count++;
    }
  } catch (err) {
    logger.warn('Instagram Apify agent failed', { error: err.message });
  }
  return { count };
}

async function startApifyRun() {
  const { data } = await axios.post(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs`,
    { hashtags: HASHTAGS, resultsLimit: 50 },
    {
      headers: { Authorization: `Bearer ${agents.apifyApiKey}` },
      timeout: 15000,
    }
  );
  return data.data.id;
}

async function pollApifyResults(runId, maxWaitMs = 300000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 10000));
    const { data: status } = await axios.get(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: { Authorization: `Bearer ${agents.apifyApiKey}` }, timeout: 10000 }
    );
    if (status.data.status === 'SUCCEEDED') {
      const { data: dataset } = await axios.get(
        `https://api.apify.com/v2/actor-runs/${runId}/dataset/items`,
        { headers: { Authorization: `Bearer ${agents.apifyApiKey}` }, timeout: 15000 }
      );
      return dataset || [];
    }
    if (['FAILED', 'ABORTED', 'TIMED-OUT'].includes(status.data.status)) {
      throw new Error(`Apify run ${runId} ended with status: ${status.data.status}`);
    }
  }
  throw new Error('Apify polling timed out');
}

async function upsertContent(item, city) {
  const externalId = `ig_${item.id || item.shortCode}`;
  const ageHours = item.timestamp
    ? (Date.now() - new Date(item.timestamp * 1000).getTime()) / 3600000
    : 1;
  const freshness = ageHours < 2 ? 'breaking' : ageHours < 12 ? 'rising' : ageHours < 48 ? 'viral' : 'expired';
  if (freshness === 'expired') return;

  const existing = await query(`SELECT id FROM content_items WHERE external_id = $1`, [externalId]);
  let contentId;

  if (existing.rows.length) {
    contentId = existing.rows[0].id;
    await query(
      `UPDATE content_items SET views = $1, comments = $2, updated_at = NOW() WHERE id = $3`,
      [item.videoViewCount || item.likesCount || 0, item.commentsCount || 0, contentId]
    );
  } else {
    const ins = await query(
      `INSERT INTO content_items
         (external_id, title, summary_en, canonical_url, thumbnail_url, platform_sources,
          category, freshness_state, city, geographic_level, views, comments,
          creator_name, first_seen_at, country_code)
       VALUES ($1,$2,$3,$4,$5,$6,'entertainment',$7,$8,'city',$9,$10,$11,NOW(),'IN')
       RETURNING id`,
      [
        externalId,
        item.caption ? item.caption.substring(0, 150) : 'Instagram Reel',
        item.caption || '',
        `https://www.instagram.com/p/${item.shortCode}/`,
        item.displayUrl || item.thumbnailSrc || null,
        JSON.stringify([PLATFORMS.INSTAGRAM]),
        freshness, city,
        item.videoViewCount || item.likesCount || 0,
        item.commentsCount || 0,
        item.ownerUsername || '',
      ]
    );
    contentId = ins.rows[0].id;
  }

  await viralScore.calculate({
    id: contentId, city, category: 'entertainment',
    platformSources: [PLATFORMS.INSTAGRAM],
    views: item.videoViewCount || 0,
    comments: item.commentsCount || 0,
    shares: 0, ageHours,
  });
}

module.exports = { run };
