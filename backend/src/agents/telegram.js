'use strict';

const axios = require('axios');
const { query } = require('../config/database');
const { CITIES, PLATFORMS } = require('../config/constants');
const viralScore = require('../scoring/viralScore');
const logger = require('../utils/logger');

// Public Telegram channels tracked — news, politics, local city channels
// No auth required for public channel RSS feeds via t.me/s/<channel>
const CHANNELS = [
  { handle: 'indiatodaynews',   category: 'world',         cities: [] },
  { handle: 'ndtvnews',         category: 'world',         cities: [] },
  { handle: 'cricketaddictor',  category: 'sports',        cities: [] },
  { handle: 'bollywoodflash',   category: 'entertainment', cities: [] },
];

async function run() {
  let count = 0;
  for (const channel of CHANNELS) {
    try {
      const posts = await fetchChannel(channel.handle);
      for (const post of posts) {
        await upsertContent(post, channel, CITIES[0].name);
        count++;
      }
    } catch (err) {
      logger.warn('Telegram channel fetch failed', { channel: channel.handle, error: err.message });
    }
  }
  return { count };
}

async function fetchChannel(handle) {
  // Public channel web view — no API key needed
  const url = `https://t.me/s/${handle}`;
  const { data } = await axios.get(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; WhatsViral/1.0)' },
    timeout: 10000,
  });

  const posts = [];
  const messageRegex = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/g;
  const timeRegex = /<time[^>]+datetime="([^"]+)"/;
  const linkRegex = /<a[^>]+href="(https?:\/\/[^"]+)"/;

  let match;
  while ((match = messageRegex.exec(data)) !== null) {
    const text = match[1].replace(/<[^>]+>/g, '').trim();
    if (!text || text.length < 20) continue;
    const timeMatch = timeRegex.exec(match[0]);
    const linkMatch = linkRegex.exec(match[0]);
    posts.push({
      text: text.substring(0, 500),
      publishedAt: timeMatch ? timeMatch[1] : new Date().toISOString(),
      sourceUrl: linkMatch ? linkMatch[1] : `https://t.me/${handle}`,
    });
  }
  return posts.slice(0, 10);
}

async function upsertContent(post, channel, city) {
  const externalId = `tg_${channel.handle}_${Buffer.from(post.text.substring(0, 50)).toString('base64').substring(0, 20)}`;
  const ageHours = (Date.now() - new Date(post.publishedAt).getTime()) / 3600000;
  const freshness = ageHours < 2 ? 'breaking' : ageHours < 12 ? 'rising' : ageHours < 48 ? 'viral' : 'expired';
  if (freshness === 'expired') return;

  const existing = await query(`SELECT id FROM content_items WHERE external_id = $1`, [externalId]);
  let contentId;

  if (existing.rows.length) {
    contentId = existing.rows[0].id;
  } else {
    const ins = await query(
      `INSERT INTO content_items
         (external_id, title, summary_en, canonical_url, platform_sources,
          category, freshness_state, city, geographic_level, first_seen_at, country_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'national',NOW(),'IN')
       RETURNING id`,
      [
        externalId, post.text.substring(0, 150), post.text,
        post.sourceUrl, JSON.stringify([PLATFORMS.TELEGRAM]),
        channel.category, freshness, city,
      ]
    );
    contentId = ins.rows[0].id;
  }

  await viralScore.calculate({
    id: contentId, city, category: channel.category,
    platformSources: [PLATFORMS.TELEGRAM],
    views: 0, comments: 0, shares: 0, ageHours,
  });
}

module.exports = { run };
