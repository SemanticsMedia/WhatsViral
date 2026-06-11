'use strict';

const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const { query } = require('../config/database');
const { CITIES, PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

const parser = new XMLParser({ ignoreAttributes: false, cdataPropName: '__cdata' });

async function run() {
  let count = 0;
  const geosSeen = new Set();

  for (const city of CITIES) {
    const geo = city.gtGeo;
    if (geosSeen.has(geo)) continue;
    geosSeen.add(geo);

    try {
      const items = await fetchTrends(geo);
      for (const item of items) {
        await upsertContent(item, city.name, geo);
        count++;
      }
    } catch (err) {
      logger.warn('Google Trends fetch failed', { geo, error: err.message });
    }
  }

  return { count };
}

async function fetchTrends(geo) {
  const url = `https://trends.google.com/trends/trendingsearches/daily/rss${geo ? `?geo=${geo}` : ''}`;
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsViral/1.0)' },
    timeout: 10000,
  });

  const parsed = parser.parse(data);
  const rawItems = parsed?.rss?.channel?.item || [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.map(item => {
    const title = item.title?.__cdata || item.title || '';
    const traffic = item['ht:approx_traffic'] || '';
    const snippet = item['ht:news_item']?.['ht:news_item_snippet']?.__cdata || '';
    return { title, traffic, snippet, geo };
  }).filter(i => i.title);
}

function trafficToValue(traffic) {
  const t = (traffic || '').replace(/\+/g, '').trim().toLowerCase();
  if (t.includes('m')) return Math.min(98, Math.round(parseFloat(t) * 2 + 60));
  if (t.includes('k')) {
    const k = parseFloat(t);
    if (k >= 500) return 90; if (k >= 200) return 80;
    if (k >= 100) return 70; if (k >= 50) return 62;
    return 52;
  }
  return 50;
}

async function upsertContent(item, city, geo) {
  const externalId = `gt_${geo}_${item.title.replace(/\s+/g, '_').toLowerCase()}`;
  const views = trafficToValue(item.traffic) * 1000;

  const existing = await query(
    `SELECT id FROM content_items WHERE external_id = $1`, [externalId]
  );

  let contentId;
  if (existing.rows.length) {
    contentId = existing.rows[0].id;
    await query(
      `UPDATE content_items SET views = $1, freshness_state = 'breaking', updated_at = NOW() WHERE id = $2`,
      [views, contentId]
    );
  } else {
    const ins = await query(
      `INSERT INTO content_items
         (external_id, title, summary_en, canonical_url, platform_sources,
          category, freshness_state, city, geographic_level, views, first_seen_at, country_code)
       VALUES ($1,$2,$3,$4,$5,'world','breaking',$6,'city',$7,NOW(),'IN')
       RETURNING id`,
      [externalId, item.title, item.snippet,
       `https://trends.google.com/trends/explore?q=${encodeURIComponent(item.title)}&geo=${geo}`,
       JSON.stringify([PLATFORMS.GOOGLE]), city, views]
    );
    contentId = ins.rows[0].id;
  }

  await viralScore.calculate({
    id: contentId, city, category: 'world',
    platformSources: [PLATFORMS.GOOGLE],
    views, comments: 0, shares: 0, ageHours: 0,
  });
}

module.exports = { run };
