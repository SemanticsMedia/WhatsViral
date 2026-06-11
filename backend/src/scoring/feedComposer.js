'use strict';

const { query } = require('../config/database');
const {
  SLOT_CONFIG,
  GEOGRAPHIC_CASCADE,
  FEED_MIN_CITY_ITEMS,
  FEED_MIN_TOTAL_ITEMS,
  CONTENT_FRESHNESS,
  SCORE_DELTA_REDEMOTION,
} = require('../config/constants');

/**
 * Feed composer — produces the 10-card set sequence.
 * Geographic cascade: City → State → Region → National → Global.
 * Slot config defaults to organic for all positions.
 * SLOT_CONFIG must never be changed without owner instruction.
 */
async function compose({ city, lang, category, cursor, userId, deviceId }) {
  const seenIds = await getSeenIds(userId, deviceId);
  const timeOfDay = getTimeOfDay();

  let items = await fetchCandidates(city, category, lang);

  if (items.filter(i => i.geographic_level === 'city').length < FEED_MIN_CITY_ITEMS) {
    items = await fillWithCascade(items, city, category, lang);
  }

  const tiered = tier(items, seenIds);
  const sets = buildSets(tiered, timeOfDay);
  const paginated = paginate(sets, cursor);

  return {
    items: paginated.items,
    nextCursor: paginated.nextCursor,
    meta: { city, timeOfDay, totalCandidates: items.length },
  };
}

async function fetchCandidates(city, category, lang) {
  const catFilter = category && category !== 'all' ? `AND ci.category = '${category}'` : '';
  const result = await query(
    `SELECT ci.id, ci.title, ci.summary_${lang} as summary, ci.category,
            ci.freshness_state, ci.platform_sources, ci.city,
            ci.geographic_level, ci.content_format, ci.emotional_register,
            ci.canonical_url, ci.thumbnail_url, ci.creator_id,
            ci.first_seen_at,
            vs.score as viral_score,
            au.score as authenticity_score, au.seems_promoted,
            COALESCE(cr.report_count, 0) as report_count
     FROM content_items ci
     JOIN LATERAL (
       SELECT score FROM viral_score_history
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT score, seems_promoted FROM authenticity_scores
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) au ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) as report_count FROM content_reports WHERE content_id = ci.id
     ) cr ON true
     WHERE ci.city = $1
       AND ci.freshness_state IN ('breaking', 'rising', 'viral')
       ${catFilter}
     ORDER BY vs.score DESC
     LIMIT 60`,
    [city]
  );
  return result.rows;
}

async function fillWithCascade(items, city, category, lang) {
  const cityCount = items.length;
  const needed = FEED_MIN_TOTAL_ITEMS - cityCount;
  if (needed <= 0) return items;

  const existingIds = items.map(i => `'${i.id}'`).join(',') || "'__none__'";
  const catFilter = category && category !== 'all' ? `AND ci.category = '${category}'` : '';

  const result = await query(
    `SELECT ci.id, ci.title, ci.summary_${lang} as summary, ci.category,
            ci.freshness_state, ci.platform_sources, ci.city,
            ci.geographic_level, ci.content_format, ci.emotional_register,
            ci.canonical_url, ci.thumbnail_url, ci.creator_id,
            ci.first_seen_at,
            vs.score as viral_score,
            au.score as authenticity_score, au.seems_promoted,
            COALESCE(cr.report_count, 0) as report_count
     FROM content_items ci
     JOIN LATERAL (
       SELECT score FROM viral_score_history
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) vs ON true
     LEFT JOIN LATERAL (
       SELECT score, seems_promoted FROM authenticity_scores
       WHERE content_id = ci.id ORDER BY calculated_at DESC LIMIT 1
     ) au ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*) as report_count FROM content_reports WHERE content_id = ci.id
     ) cr ON true
     WHERE ci.id NOT IN (${existingIds})
       AND ci.geographic_level IN ('state','region','national','global')
       AND ci.freshness_state IN ('breaking','rising','viral')
       ${catFilter}
     ORDER BY vs.score DESC
     LIMIT $1`,
    [needed]
  );

  return [...items, ...result.rows];
}

async function getSeenIds(userId, deviceId) {
  if (!userId && !deviceId) return new Map();
  const result = await query(
    `SELECT content_id, viral_score_at_view FROM seen_content
     WHERE (user_id = $1 OR device_id = $2)
       AND seen_at > NOW() - INTERVAL '30 days'`,
    [userId || null, deviceId || null]
  );
  return new Map(result.rows.map(r => [r.content_id, r.viral_score_at_view]));
}

function tier(items, seenIds) {
  return items.map(item => {
    const seenScore = seenIds.get(item.id);
    if (seenScore === undefined) return { ...item, tier: 1 };
    const delta = item.viral_score - seenScore;
    if (delta >= SCORE_DELTA_REDEMOTION) return { ...item, tier: 2 };
    return { ...item, tier: 3 };
  }).sort((a, b) => a.tier - b.tier || b.viral_score - a.viral_score);
}

function buildSets(tiered, timeOfDay) {
  const breaking = tiered.filter(i => i.freshness_state === CONTENT_FRESHNESS.BREAKING);
  const rising   = tiered.filter(i => i.freshness_state === CONTENT_FRESHNESS.RISING);
  const viral    = tiered.filter(i => i.freshness_state === CONTENT_FRESHNESS.VIRAL);

  const sets = [];
  let breakIdx = 0, riseIdx = 0, viralIdx = 0, tieredIdx = 0;
  const all = tiered;

  while (all[tieredIdx]) {
    const set = [];

    // Cards 1-2: Breaking local
    for (let i = 0; i < 2 && breakIdx < breaking.length; i++, breakIdx++) set.push(breaking[breakIdx]);
    // Cards 3-4: Rising
    for (let i = 0; i < 2 && riseIdx < rising.length; i++, riseIdx++) set.push(rising[riseIdx]);
    // Cards 5-7: Viral
    for (let i = 0; i < 3 && viralIdx < viral.length; i++, viralIdx++) set.push(viral[viralIdx]);
    // Card 8: Breakout — highest breakout_factor in remaining
    const breakout = all.find(i => !set.includes(i) && i.geographic_level === 'city');
    if (breakout) set.push(breakout);
    // Card 9: Local discovery
    const local = all.find(i => !set.includes(i) && i.geographic_level === 'city');
    if (local) set.push(local);
    // Card 10: Cascade wildcard — slot_type is 'organic', always serves organic content
    if (SLOT_CONFIG.card_10.slot_type === 'organic') {
      const cascade = all.find(i => !set.includes(i) && i.geographic_level !== 'city');
      if (cascade) set.push(cascade);
    }

    if (set.length === 0) break;
    set.forEach(i => { tieredIdx++; });
    sets.push(applyVariety(set, timeOfDay));
  }

  return sets;
}

function applyVariety(set, timeOfDay) {
  // No two consecutive cards same format or emotional register
  const result = [...set];
  for (let i = 1; i < result.length; i++) {
    if (
      result[i].content_format === result[i - 1].content_format ||
      result[i].emotional_register === result[i - 1].emotional_register
    ) {
      const swap = result.slice(i + 1).findIndex(c =>
        c.content_format !== result[i - 1].content_format &&
        c.emotional_register !== result[i - 1].emotional_register
      );
      if (swap !== -1) {
        [result[i], result[i + 1 + swap]] = [result[i + 1 + swap], result[i]];
      }
    }
  }
  return result;
}

function paginate(sets, cursor) {
  const flat = sets.flat();
  if (!cursor) return { items: flat.slice(0, 30), nextCursor: flat[30]?.id || null };
  const idx = flat.findIndex(i => i.id === cursor);
  if (idx === -1) return { items: flat.slice(0, 30), nextCursor: flat[30]?.id || null };
  const start = idx + 1;
  return { items: flat.slice(start, start + 30), nextCursor: flat[start + 30]?.id || null };
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h >= 5 && h < 11)  return 'morning';
  if (h >= 11 && h < 17) return 'midday';
  if (h >= 17 && h < 22) return 'evening';
  return 'late_night';
}

module.exports = { compose };
