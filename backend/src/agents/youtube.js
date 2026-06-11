'use strict';

const axios = require('axios');
const { agents } = require('../config/env');
const { query } = require('../config/database');
const { CITIES, PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

const YT_CATEGORIES = [
  { id: '17', category: 'sports' },
  { id: '25', category: 'politics' },
  { id: '28', category: 'tech' },
  { id: '22', category: 'lifestyle' },
  { id: '10', category: 'entertainment' },
  { id: '24', category: 'entertainment' },
  { id: '27', category: 'culture' },
];

async function run() {
  let count = 0;
  const errors = [];

  for (const city of CITIES) {
    for (const bucket of YT_CATEGORIES) {
      try {
        const items = await fetchBucket(city.ytRegion, bucket.id, 10);
        for (const item of items) {
          await upsertContent(item, city.name, bucket.category);
          count++;
        }
      } catch (err) {
        errors.push({ city: city.name, cat: bucket.id, error: err.message });
      }
    }
  }

  if (errors.length) logger.warn('YouTube agent partial errors', { errors });
  return { count, errors: errors.length };
}

async function fetchBucket(region, categoryId, maxResults) {
  const url = 'https://www.googleapis.com/youtube/v3/videos';
  const { data } = await axios.get(url, {
    params: {
      part: 'snippet,statistics',
      chart: 'mostPopular',
      regionCode: region,
      videoCategoryId: categoryId,
      maxResults,
      key: agents.youtubeApiKey,
    },
    timeout: 12000,
  });

  return (data.items || []).map(item => {
    const s = item.snippet;
    const st = item.statistics;
    return {
      externalId: `yt_${item.id}`,
      title: s.title,
      canonicalUrl: `https://www.youtube.com/watch?v=${item.id}`,
      thumbnailUrl: s.thumbnails?.high?.url || s.thumbnails?.medium?.url || null,
      platform: PLATFORMS.YOUTUBE,
      views: parseInt(st.viewCount) || 0,
      comments: parseInt(st.commentCount) || 0,
      shares: 0,
      publishedAt: s.publishedAt,
      creatorName: s.channelTitle,
      creatorExternalId: `yt_channel_${s.channelId}`,
    };
  });
}

async function upsertContent(item, city, category) {
  const ageHours = (Date.now() - new Date(item.publishedAt).getTime()) / 3600000;
  const freshness = ageHours < 2 ? 'breaking' : ageHours < 12 ? 'rising' : ageHours < 48 ? 'viral' : 'expired';
  if (freshness === 'expired') return;

  const existing = await query(
    `SELECT id FROM content_items WHERE external_id = $1`,
    [item.externalId]
  );

  let contentId;
  if (existing.rows.length) {
    contentId = existing.rows[0].id;
    await query(
      `UPDATE content_items
       SET views = $1, comments = $2, freshness_state = $3, updated_at = NOW()
       WHERE id = $4`,
      [item.views, item.comments, freshness, contentId]
    );
  } else {
    const ins = await query(
      `INSERT INTO content_items
         (external_id, title, canonical_url, thumbnail_url, platform_sources,
          category, freshness_state, city, geographic_level, views, comments,
          creator_name, creator_external_id, first_seen_at, country_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'city',$9,$10,$11,$12,NOW(),'IN')
       RETURNING id`,
      [
        item.externalId, item.title, item.canonicalUrl, item.thumbnailUrl,
        JSON.stringify([item.platform]), category, freshness, city,
        item.views, item.comments, item.creatorName, item.creatorExternalId,
      ]
    );
    contentId = ins.rows[0].id;
  }

  await viralScore.calculate({
    id: contentId, city, category,
    platformSources: [item.platform],
    views: item.views, comments: item.comments, shares: 0,
    ageHours,
  });
}

module.exports = { run };
