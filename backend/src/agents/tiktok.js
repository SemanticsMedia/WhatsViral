'use strict';

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const { CITIES, PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

// Apify actor for TikTok trending. ~1hr lag. Weight 80%.
const APIFY_ACTOR_ID = 'clockworks~tiktok-scraper';

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
    logger.warn('TikTok Apify agent failed', { error: err.message });
  }
  return { count };
}

async function startApifyRun() {
  const { data } = await axios.post(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs`,
    { hashtags: ['india', 'viral', 'trending', 'cricket', 'bollywood'], resultsPerPage: 30 },
    { headers: { Authorization: `Bearer ${agents.apifyApiKey}` }, timeout: 15000 }
  );
  return data.data.id;
}

async function pollApifyResults(runId, maxWaitMs = 300000) {
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 12000));
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
      throw new Error(`TikTok Apify run ${runId}: ${status.data.status}`);
    }
  }
  throw new Error('TikTok Apify polling timed out');
}

async function upsertContent(item, city) {
  const externalId = `tt_${item.id}`;
  const ageHours = item.createTime
    ? (Date.now() - item.createTime * 1000) / 3600000
    : 1;
  const freshness = ageHours < 2 ? 'breaking' : ageHours < 12 ? 'rising' : ageHours < 48 ? 'viral' : 'expired';
  if (freshness === 'expired') return;

  const existing = await query(`SELECT id FROM content_items WHERE external_id = $1`, [externalId]);
  let contentId;

  if (existing.rows.length) {
    contentId = existing.rows[0].id;
    await query(
      `UPDATE content_items SET views = $1, comments = $2, updated_at = NOW() WHERE id = $3`,
      [item.playCount || 0, item.commentCount || 0, contentId]
    );
  } else {
    const ins = await query(
      `INSERT INTO content_items
         (external_id, title, canonical_url, thumbnail_url, platform_sources,
          category, freshness_state, city, geographic_level, views, comments,
          creator_name, first_seen_at, country_code)
       VALUES ($1,$2,$3,$4,$5,'entertainment',$6,$7,'city',$8,$9,$10,NOW(),'IN')
       RETURNING id`,
      [
        externalId,
        item.desc ? item.desc.substring(0, 150) : 'TikTok Video',
        `https://www.tiktok.com/@${item.authorMeta?.name}/video/${item.id}`,
        item.covers?.default || null,
        JSON.stringify([PLATFORMS.TIKTOK]),
        freshness, city,
        item.playCount || 0,
        item.commentCount || 0,
        item.authorMeta?.name || '',
      ]
    );
    contentId = ins.rows[0].id;
  }

  await viralScore.calculate({
    id: contentId, city, category: 'entertainment',
    platformSources: [PLATFORMS.TIKTOK],
    views: item.playCount || 0,
    comments: item.commentCount || 0,
    shares: item.shareCount || 0,
    ageHours,
  });
}

module.exports = { run };
