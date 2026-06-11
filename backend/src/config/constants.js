'use strict';

const CITIES = [
  { name: 'Lucknow',       region: 'north',   state: 'Uttar Pradesh',   gtGeo: 'IN-UP', ytRegion: 'IN' },
  { name: 'Jaipur',        region: 'north',   state: 'Rajasthan',       gtGeo: 'IN-RJ', ytRegion: 'IN' },
  { name: 'Chandigarh',    region: 'north',   state: 'Chandigarh',      gtGeo: 'IN-CH', ytRegion: 'IN' },
  { name: 'Agra',          region: 'north',   state: 'Uttar Pradesh',   gtGeo: 'IN-UP', ytRegion: 'IN' },
  { name: 'Surat',         region: 'west',    state: 'Gujarat',         gtGeo: 'IN-GJ', ytRegion: 'IN' },
  { name: 'Nagpur',        region: 'west',    state: 'Maharashtra',     gtGeo: 'IN-MH', ytRegion: 'IN' },
  { name: 'Vadodara',      region: 'west',    state: 'Gujarat',         gtGeo: 'IN-GJ', ytRegion: 'IN' },
  { name: 'Nashik',        region: 'west',    state: 'Maharashtra',     gtGeo: 'IN-MH', ytRegion: 'IN' },
  { name: 'Coimbatore',    region: 'south',   state: 'Tamil Nadu',      gtGeo: 'IN-TN', ytRegion: 'IN' },
  { name: 'Kochi',         region: 'south',   state: 'Kerala',          gtGeo: 'IN-KL', ytRegion: 'IN' },
  { name: 'Visakhapatnam', region: 'south',   state: 'Andhra Pradesh',  gtGeo: 'IN-AP', ytRegion: 'IN' },
  { name: 'Mysuru',        region: 'south',   state: 'Karnataka',       gtGeo: 'IN-KA', ytRegion: 'IN' },
  { name: 'Patna',         region: 'east',    state: 'Bihar',           gtGeo: 'IN-BR', ytRegion: 'IN' },
  { name: 'Bhubaneswar',   region: 'east',    state: 'Odisha',          gtGeo: 'IN-OR', ytRegion: 'IN' },
  { name: 'Guwahati',      region: 'east',    state: 'Assam',           gtGeo: 'IN-AS', ytRegion: 'IN' },
  { name: 'Ranchi',        region: 'east',    state: 'Jharkhand',       gtGeo: 'IN-JH', ytRegion: 'IN' },
  { name: 'Indore',        region: 'central', state: 'Madhya Pradesh',  gtGeo: 'IN-MP', ytRegion: 'IN' },
  { name: 'Bhopal',        region: 'central', state: 'Madhya Pradesh',  gtGeo: 'IN-MP', ytRegion: 'IN' },
  { name: 'Raipur',        region: 'central', state: 'Chhattisgarh',    gtGeo: 'IN-CT', ytRegion: 'IN' },
  { name: 'Varanasi',      region: 'central', state: 'Uttar Pradesh',   gtGeo: 'IN-UP', ytRegion: 'IN' },
];

const LANGUAGES = [
  { code: 'hi', name: 'Hindi',     nativeScript: 'हिंदी',    murilCode: 'hi' },
  { code: 'mr', name: 'Marathi',   nativeScript: 'मराठी',   murilCode: 'mr' },
  { code: 'ta', name: 'Tamil',     nativeScript: 'தமிழ்',   murilCode: 'ta' },
  { code: 'ml', name: 'Malayalam', nativeScript: 'മലയാളം', murilCode: 'ml' },
  { code: 'te', name: 'Telugu',    nativeScript: 'తెలుగు',  murilCode: 'te' },
  { code: 'en', name: 'English',   nativeScript: 'English',  murilCode: 'en' },
];

const CONTENT_FRESHNESS = {
  BREAKING: 'breaking',
  RISING:   'rising',
  VIRAL:    'viral',
};

const FRESHNESS_WINDOWS = {
  [CONTENT_FRESHNESS.BREAKING]: { minHours: 0,  maxHours: 2  },
  [CONTENT_FRESHNESS.RISING]:   { minHours: 2,  maxHours: 12 },
  [CONTENT_FRESHNESS.VIRAL]:    { minHours: 12, maxHours: 48 },
};

const PLATFORMS = {
  YOUTUBE:    'youtube',
  GOOGLE:     'google',
  REDDIT:     'reddit',
  GOOGLE_NEWS:'google_news',
  TELEGRAM:   'telegram',
  INSTAGRAM:  'instagram',
  TIKTOK:     'tiktok',
  LINKEDIN:   'linkedin',
  SHARECHAT:  'sharechat',
  WHATSAPP:   'whatsapp',
};

// Agent signal weights — applied in ViralScore engine
const AGENT_WEIGHTS = {
  [PLATFORMS.YOUTUBE]:     1.0,
  [PLATFORMS.GOOGLE]:      1.0,
  [PLATFORMS.REDDIT]:      1.0,
  [PLATFORMS.GOOGLE_NEWS]: 1.0,
  [PLATFORMS.TELEGRAM]:    1.0,
  [PLATFORMS.INSTAGRAM]:   0.8,
  [PLATFORMS.TIKTOK]:      0.8,
  [PLATFORMS.LINKEDIN]:    0.5,
  [PLATFORMS.SHARECHAT]:   0.5,
  [PLATFORMS.WHATSAPP]:    0.3,
};

// ViralScore signal weights (sum to 100 before decay)
const VIRAL_SCORE_WEIGHTS = {
  crossPlatformPresence: 25,
  velocity:              20,
  engagementQuality:     20,
  geographicSpread:      15,
  sourceDiversity:       10,
  breakoutFactor:        10,
};

const VIRAL_SCORE_DECAY = {
  maxPenalty:     20,
  halfLifeHours:  24,
  expiryHours:    48,
};

// Feed slot config — advertising is OFF. Never change slot_type without owner instruction.
const SLOT_CONFIG = {
  card_10: {
    slot_type: 'organic',
    current_content: 'cascade_wildcard',
  },
};

const CATEGORIES = [
  'sports', 'entertainment', 'politics', 'tech', 'business',
  'world', 'culture', 'lifestyle', 'breaking',
];

const GEOGRAPHIC_CASCADE = ['city', 'state', 'region', 'national', 'global'];

const SEEN_CONTENT_RETENTION_DAYS = 30;
const SHARE_LINK_TTL_HOURS        = 72;
const VIRALITY_TRACKING_HOURS     = 48;
const FEED_MIN_CITY_ITEMS         = 15;
const FEED_MIN_TOTAL_ITEMS        = 30;
const MISINFO_REPORT_THRESHOLD    = 0.01;
const MISINFO_REPORT_MIN          = 100;
const MISINFO_MAX_SCORE_PENALTY   = 10;
const SCORE_DELTA_REDEMOTION      = 15;

module.exports = {
  CITIES,
  LANGUAGES,
  CONTENT_FRESHNESS,
  FRESHNESS_WINDOWS,
  PLATFORMS,
  AGENT_WEIGHTS,
  VIRAL_SCORE_WEIGHTS,
  VIRAL_SCORE_DECAY,
  SLOT_CONFIG,
  CATEGORIES,
  GEOGRAPHIC_CASCADE,
  SEEN_CONTENT_RETENTION_DAYS,
  SHARE_LINK_TTL_HOURS,
  VIRALITY_TRACKING_HOURS,
  FEED_MIN_CITY_ITEMS,
  FEED_MIN_TOTAL_ITEMS,
  MISINFO_REPORT_THRESHOLD,
  MISINFO_REPORT_MIN,
  MISINFO_MAX_SCORE_PENALTY,
  SCORE_DELTA_REDEMOTION,
};
