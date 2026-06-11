-- WhatsViral PostgreSQL Schema
-- Covers all 66 backend components from the spec.
-- Run via: psql $DATABASE_URL -f src/db/schema.sql

BEGIN;

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- trigram search on titles
CREATE EXTENSION IF NOT EXISTS "btree_gin";    -- GIN indexes on JSONB

-- ─── REFERENCE: CITIES ───────────────────────────────────────────────────────
-- Component 1 (infrastructure reference data)
CREATE TABLE IF NOT EXISTS cities (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  region      TEXT NOT NULL,          -- north/south/east/west/central
  state       TEXT NOT NULL,
  gt_geo      TEXT NOT NULL,          -- Google Trends geo code
  yt_region   TEXT NOT NULL,          -- YouTube region code
  country     TEXT NOT NULL DEFAULT 'IN',
  is_launch   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── USERS ───────────────────────────────────────────────────────────────────
-- Component 30: account service
CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  oauth_provider  TEXT NOT NULL,                  -- 'google' | 'apple'
  oauth_subject   TEXT NOT NULL,
  email           TEXT,                           -- nulled on deletion
  display_name    TEXT,                           -- nulled on deletion
  city            TEXT,
  lang            TEXT NOT NULL DEFAULT 'en',
  account_type    TEXT NOT NULL DEFAULT 'consumer',  -- consumer | b2b | admin
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ,
  deleted_at      TIMESTAMPTZ,
  UNIQUE (oauth_provider, oauth_subject)
);

CREATE INDEX IF NOT EXISTS idx_users_oauth ON users (oauth_provider, oauth_subject);
CREATE INDEX IF NOT EXISTS idx_users_city ON users (city) WHERE deleted_at IS NULL;

-- Component 30: user sessions (JWT tracking for revocation)
CREATE TABLE IF NOT EXISTS user_sessions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  device_id   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions (token_hash);

-- ─── B2B ORGANISATIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS b2b_organisations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'entry',   -- entry | growth | enterprise
  products        TEXT[] NOT NULL DEFAULT '{}',    -- brand_pulse | creator_intel
  billing_email   TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS b2b_users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id      UUID NOT NULL REFERENCES b2b_organisations(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member',      -- admin | member
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

-- ─── CONTENT ITEMS ───────────────────────────────────────────────────────────
-- Component 36: content ID system
-- Central table — every piece of content from every agent lands here
CREATE TABLE IF NOT EXISTS content_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id           TEXT NOT NULL UNIQUE,        -- agent-scoped stable ID
  title                 TEXT NOT NULL,
  -- Per-language summaries — components 45, 44
  summary_en            TEXT,
  summary_hi            TEXT,
  summary_mr            TEXT,
  summary_ta            TEXT,
  summary_ml            TEXT,
  summary_te            TEXT,
  -- Core metadata
  canonical_url         TEXT,
  thumbnail_url         TEXT,
  platform_sources      JSONB NOT NULL DEFAULT '[]',  -- array of platform strings
  category              TEXT NOT NULL,
  freshness_state       TEXT NOT NULL DEFAULT 'breaking',  -- breaking|rising|viral|expired
  content_format        TEXT,                        -- video|article|post|reel|thread
  emotional_register    TEXT,                        -- excitement|controversy|curiosity|humour|concern
  -- Geography
  city                  TEXT,
  geographic_level      TEXT NOT NULL DEFAULT 'city',  -- city|state|region|national|global
  country_code          TEXT NOT NULL DEFAULT 'IN',
  -- Engagement signals (raw, updated by agents)
  views                 BIGINT NOT NULL DEFAULT 0,
  comments              BIGINT NOT NULL DEFAULT 0,
  shares                BIGINT NOT NULL DEFAULT 0,
  views_last_2h         BIGINT NOT NULL DEFAULT 0,
  views_prev_2h         BIGINT NOT NULL DEFAULT 0,
  -- Creator
  creator_name          TEXT,
  creator_external_id   TEXT,
  -- Scores (denormalised for query speed)
  current_viral_score   INTEGER,
  -- AI flags
  is_ai_generated       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Timestamps
  first_seen_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Moat: cluster membership
  cluster_id            UUID
);

CREATE INDEX IF NOT EXISTS idx_content_city_freshness ON content_items (city, freshness_state);
CREATE INDEX IF NOT EXISTS idx_content_score ON content_items (current_viral_score DESC);
CREATE INDEX IF NOT EXISTS idx_content_external_id ON content_items (external_id);
CREATE INDEX IF NOT EXISTS idx_content_first_seen ON content_items (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_category ON content_items (category, freshness_state);
CREATE INDEX IF NOT EXISTS idx_content_geo_level ON content_items (geographic_level, freshness_state);
CREATE INDEX IF NOT EXISTS idx_content_title_trgm ON content_items USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_content_platforms ON content_items USING GIN (platform_sources);

-- ─── VIRAL SCORE HISTORY ─────────────────────────────────────────────────────
-- Component 17: ViralScore engine persistent history (moat layer 1)
CREATE TABLE IF NOT EXISTS viral_score_history (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  score         INTEGER NOT NULL,
  signals       JSONB NOT NULL DEFAULT '{}',    -- per-signal breakdown
  weights_used  JSONB NOT NULL DEFAULT '{}',    -- which weights were applied
  city          TEXT,
  category      TEXT,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vsh_content_time ON viral_score_history (content_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_vsh_city_time ON viral_score_history (city, calculated_at DESC);

-- Component 17: Dynamic weight configuration (moat layer 1)
CREATE TABLE IF NOT EXISTS viral_score_weights (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city        TEXT,          -- NULL = global default
  category    TEXT,          -- NULL = all categories
  weights     JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (city, category)
);

-- ─── AUTHENTICITY SCORES ─────────────────────────────────────────────────────
-- Component 18: Authenticity Score engine
CREATE TABLE IF NOT EXISTS authenticity_scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id      UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  score           INTEGER NOT NULL,
  label           TEXT NOT NULL,   -- organic|unusual_pattern|possibly_coordinated|likely_coordinated
  triggers        JSONB NOT NULL DEFAULT '{}',
  seems_promoted  BOOLEAN NOT NULL DEFAULT FALSE,
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_content ON authenticity_scores (content_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_promoted ON authenticity_scores (seems_promoted) WHERE seems_promoted = TRUE;

-- ─── MOAT DATA: VIRALITY OUTCOMES ────────────────────────────────────────────
-- Component 22: 48hr post-surfacing outcome tracking
CREATE TABLE IF NOT EXISTS virality_outcomes (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id        UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  surfaced_at       TIMESTAMPTZ NOT NULL,
  score_at_surface  INTEGER NOT NULL,
  score_12h         INTEGER,
  score_24h         INTEGER,
  score_48h         INTEGER,
  peak_score        INTEGER,
  peak_at           TIMESTAMPTZ,
  final_freshness   TEXT,
  completed         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outcomes_content ON virality_outcomes (content_id);
CREATE INDEX IF NOT EXISTS idx_outcomes_pending ON virality_outcomes (completed, created_at) WHERE completed = FALSE;

-- ─── MOAT DATA: CROSS-PLATFORM CO-OCCURRENCE ─────────────────────────────────
-- Component 23: cross-platform co-occurrence logger
CREATE TABLE IF NOT EXISTS cross_platform_cooccurrence (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  platform_a    TEXT NOT NULL,
  platform_b    TEXT NOT NULL,
  first_seen_a  TIMESTAMPTZ NOT NULL,
  first_seen_b  TIMESTAMPTZ NOT NULL,
  gap_minutes   INTEGER,              -- how many minutes between platform_a and platform_b
  city          TEXT,
  logged_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cooccur_content ON cross_platform_cooccurrence (content_id);
CREATE INDEX IF NOT EXISTS idx_cooccur_platforms ON cross_platform_cooccurrence (platform_a, platform_b);

-- ─── MOAT DATA: CAMPAIGN EVENTS ──────────────────────────────────────────────
-- Component 24: campaign event tagger
CREATE TABLE IF NOT EXISTS campaign_events (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id   UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  brand_id     UUID,
  keyword      TEXT NOT NULL,
  org_id       UUID REFERENCES b2b_organisations(id),
  first_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_brand ON campaign_events (brand_id);
CREATE INDEX IF NOT EXISTS idx_campaign_keyword ON campaign_events (keyword);

-- ─── CONTENT TAGS ────────────────────────────────────────────────────────────
-- Component 20: content tagging (format, emotional register)
CREATE TABLE IF NOT EXISTS content_tags (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  tag_type      TEXT NOT NULL,   -- format | emotion | topic | language
  tag_value     TEXT NOT NULL,
  confidence    FLOAT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, tag_type, tag_value)
);

CREATE INDEX IF NOT EXISTS idx_tags_content ON content_tags (content_id);
CREATE INDEX IF NOT EXISTS idx_tags_type_value ON content_tags (tag_type, tag_value);

-- ─── VIRAL CLUSTERS ──────────────────────────────────────────────────────────
-- Component 38: viral cluster tagger (co-occurrence within 6-hour window)
CREATE TABLE IF NOT EXISTS viral_clusters (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cluster_label TEXT NOT NULL,
  topic_summary TEXT,
  first_item_at TIMESTAMPTZ NOT NULL,
  last_item_at  TIMESTAMPTZ NOT NULL,
  item_count    INTEGER NOT NULL DEFAULT 1,
  peak_score    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clusters_time ON viral_clusters (first_item_at DESC);

-- ─── SEEN CONTENT ────────────────────────────────────────────────────────────
-- Component 31: seen-content log (device and account level, 30-day retention)
CREATE TABLE IF NOT EXISTS seen_content (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id          UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id           TEXT,
  viral_score_at_view INTEGER,
  city                TEXT,
  seen_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE NULLS NOT DISTINCT (content_id, user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_seen_user ON seen_content (user_id, seen_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seen_device ON seen_content (device_id, seen_at DESC) WHERE device_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_seen_content ON seen_content (content_id);

-- Auto-purge seen content older than 30 days — enforced by cron, schema documents intent
CREATE INDEX IF NOT EXISTS idx_seen_age ON seen_content (seen_at);

-- ─── CREATORS ────────────────────────────────────────────────────────────────
-- Components 33, 34: creator profile cache
CREATE TABLE IF NOT EXISTS creators (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id         TEXT NOT NULL UNIQUE,       -- platform-scoped ID
  platform            TEXT NOT NULL,
  name                TEXT NOT NULL,
  bio_one_liner       TEXT,
  profile_url         TEXT NOT NULL,
  avatar_url          TEXT,
  primary_city        TEXT,
  follower_count      BIGINT,
  viral_count         INTEGER NOT NULL DEFAULT 0, -- times appeared on WV
  authenticity_score  INTEGER,
  first_seen_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creators_platform ON creators (platform);
CREATE INDEX IF NOT EXISTS idx_creators_city ON creators (primary_city);
CREATE INDEX IF NOT EXISTS idx_creators_viral_count ON creators (viral_count DESC);

-- Component 33: saved creators (device level V1, account level V2)
CREATE TABLE IF NOT EXISTS saved_creators (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  creator_id  UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, creator_id)
);

-- Component 54: creator intelligence profiles
CREATE TABLE IF NOT EXISTS creator_profiles (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id          UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE UNIQUE,
  viral_count         INTEGER NOT NULL DEFAULT 0,
  organic_score       INTEGER,
  authenticity_score  INTEGER,
  top_categories      TEXT[],
  city_spread         JSONB,     -- {city: count}
  cross_platform_ids  JSONB,     -- {platform: external_id}
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SHARE LINKS ─────────────────────────────────────────────────────────────
-- Component 37: share link generator (72hr persistence)
CREATE TABLE IF NOT EXISTS share_links (
  share_id             TEXT PRIMARY KEY,           -- 12-char alphanumeric
  content_id           UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  viral_score_snapshot INTEGER NOT NULL,
  created_by_user      UUID REFERENCES users(id),
  expires_at           TIMESTAMPTZ NOT NULL,
  click_count          INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_share_links_content ON share_links (content_id);
CREATE INDEX IF NOT EXISTS idx_share_links_expiry ON share_links (expires_at);

-- ─── CONTENT REPORTS ─────────────────────────────────────────────────────────
-- Component 64 + misinformation reporting
CREATE TABLE IF NOT EXISTS content_reports (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id          UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  reason              TEXT NOT NULL,    -- false_misleading|harmful|spam|other
  detail              TEXT,
  reporter_user_id    UUID REFERENCES users(id),
  reporter_device_id  TEXT,
  reporter_ip         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_content ON content_reports (content_id);
CREATE INDEX IF NOT EXISTS idx_reports_time ON content_reports (created_at DESC);

-- ─── WHATSAPP SUBMISSIONS ────────────────────────────────────────────────────
-- Component 16: WhatsApp submission handler
CREATE TABLE IF NOT EXISTS whatsapp_submissions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content               TEXT NOT NULL,
  source_url            TEXT,
  city                  TEXT NOT NULL,
  lang                  TEXT NOT NULL DEFAULT 'en',
  submitter_phone_hash  TEXT,              -- SHA-256, never raw phone
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending|awaiting_review|published|rejected
  reject_reason         TEXT,
  reviewer_id           UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  content_id            UUID REFERENCES content_items(id),
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_status ON whatsapp_submissions (status, created_at);

-- ─── CONTENT EMBEDDINGS ──────────────────────────────────────────────────────
-- Components 25, 26, 27, 28, 29: embeddings + model versioning
CREATE TABLE IF NOT EXISTS content_embeddings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  model_name    TEXT NOT NULL,     -- 'muril' | 'indicbert_v2'
  model_version TEXT NOT NULL,     -- e.g. '1.0.0' — versioned from day one
  vector_id     TEXT NOT NULL,     -- Pinecone vector ID
  language      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, model_name, model_version)
);

CREATE INDEX IF NOT EXISTS idx_embeddings_content ON content_embeddings (content_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_model ON content_embeddings (model_name, model_version);

-- ─── CONTENT SUMMARIES ───────────────────────────────────────────────────────
-- Component 45: language-specific card generation (on-demand, cached permanently)
CREATE TABLE IF NOT EXISTS content_summaries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id  UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  lang        TEXT NOT NULL,
  summary     TEXT NOT NULL,
  generated_by TEXT NOT NULL,     -- 'gemini' | 'claude' | 'manual'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, lang)
);

CREATE INDEX IF NOT EXISTS idx_summaries_content ON content_summaries (content_id);

-- Component 47: translate on demand cache
CREATE TABLE IF NOT EXISTS translation_cache (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  source_lang   TEXT NOT NULL,
  target_lang   TEXT NOT NULL,
  translated    TEXT NOT NULL,
  generated_by  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (content_id, source_lang, target_lang)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
-- Component 35: notification service
CREATE TABLE IF NOT EXISTS notification_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type            TEXT NOT NULL,   -- you_saw_first|city_alert|crisis_alert|breaking
  content_id      UUID REFERENCES content_items(id),
  payload         JSONB NOT NULL DEFAULT '{}',
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notification_log (user_id, sent_at DESC);

-- ─── BRAND ENTITIES ──────────────────────────────────────────────────────────
-- Component 50: brand entity database
CREATE TABLE IF NOT EXISTS brand_entities (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  logo_url        TEXT,
  website         TEXT,
  categories      TEXT[],
  -- Knowledge Graph sources
  kg_id           TEXT,            -- Google Knowledge Graph ID
  wikidata_id     TEXT,
  openfoodfacts_id TEXT,
  -- B2B tracking
  tracked_by      UUID[],          -- array of org_ids tracking this brand
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brands_slug ON brand_entities (slug);
CREATE INDEX IF NOT EXISTS idx_brands_name_trgm ON brand_entities USING GIN (name gin_trgm_ops);

-- Component 51: Brand Pulse metrics (materialised, recalculated per cycle)
CREATE TABLE IF NOT EXISTS brand_metrics (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id            UUID NOT NULL REFERENCES brand_entities(id) ON DELETE CASCADE,
  viral_score         INTEGER,
  velocity_24h        FLOAT,              -- % change in score over 24h
  organic_pct         FLOAT,
  coordinated_pct     FLOAT,
  platform_breakdown  JSONB,
  city_spread         JSONB,
  sentiment_summary   JSONB,
  competitor_scores   JSONB,
  calculated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_metrics_brand ON brand_metrics (brand_id, calculated_at DESC);

-- Component 53: Crisis Radar — brand baselines
CREATE TABLE IF NOT EXISTS brand_baselines (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id                  UUID NOT NULL REFERENCES brand_entities(id) ON DELETE CASCADE UNIQUE,
  avg_viral_score_7d        FLOAT,
  avg_sentiment_score_7d    FLOAT,
  avg_mention_volume_7d     FLOAT,
  last_baseline_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Component 53: Crisis Radar — alerts
CREATE TABLE IF NOT EXISTS brand_alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_id        UUID NOT NULL REFERENCES brand_entities(id) ON DELETE CASCADE,
  org_id          UUID NOT NULL REFERENCES b2b_organisations(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL,   -- sentiment_spike|viral_spike|authenticity_drop|daily_digest
  severity        TEXT NOT NULL DEFAULT 'medium',  -- low|medium|high|critical
  headline        TEXT NOT NULL,
  narrative       TEXT,            -- 3-sentence Claude Sonnet brief
  response_window TEXT,            -- e.g. "Act within 2 hours"
  content_ids     UUID[],
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_brand ON brand_alerts (brand_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_org ON brand_alerts (org_id, created_at DESC);

-- Component 52: Campaign Intelligence
CREATE TABLE IF NOT EXISTS campaign_trackers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES b2b_organisations(id) ON DELETE CASCADE,
  brand_id            UUID REFERENCES brand_entities(id),
  name                TEXT NOT NULL,
  keywords            TEXT[] NOT NULL,
  start_date          DATE NOT NULL,
  end_date            DATE,
  city_adoption       JSONB,              -- {city: first_seen_at}
  predicted_peak      TIMESTAMPTZ,
  organic_spread_pct  FLOAT,
  status              TEXT NOT NULL DEFAULT 'active',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_org ON campaign_trackers (org_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_brand ON campaign_trackers (brand_id);

-- ─── B2B SUBSCRIPTIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS b2b_subscriptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id        UUID NOT NULL REFERENCES b2b_organisations(id) ON DELETE CASCADE,
  product       TEXT NOT NULL,    -- brand_pulse | creator_intelligence
  plan          TEXT NOT NULL,    -- entry | growth | enterprise
  price_inr     INTEGER NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  start_date    DATE NOT NULL,
  end_date      DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DAILY DIGESTS ───────────────────────────────────────────────────────────
-- Component 55: daily digest generator
CREATE TABLE IF NOT EXISTS daily_digests (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id              UUID NOT NULL REFERENCES b2b_organisations(id) ON DELETE CASCADE,
  brand_id            UUID REFERENCES brand_entities(id),
  digest_date         DATE NOT NULL,
  content             JSONB NOT NULL,     -- structured digest payload
  email_subject       TEXT NOT NULL,
  generated_by        TEXT NOT NULL DEFAULT 'claude',
  generated_at        TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  opened_at           TIMESTAMPTZ,
  UNIQUE (org_id, brand_id, digest_date)
);

CREATE INDEX IF NOT EXISTS idx_digests_org ON daily_digests (org_id, delivered_at DESC);

-- ─── AI USAGE LOG ────────────────────────────────────────────────────────────
-- Component 49: cost monitoring dashboard
CREATE TABLE IF NOT EXISTS ai_usage_log (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider          TEXT NOT NULL,     -- gemini | claude
  feature           TEXT NOT NULL,     -- card_summary | translation | digest | crisis_narrative
  tokens_in         INTEGER,
  tokens_out        INTEGER,
  estimated_cost_usd FLOAT,
  duration_ms       INTEGER,
  success           BOOLEAN NOT NULL DEFAULT TRUE,
  error_msg         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_log (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_log (DATE_TRUNC('day', created_at));

-- ─── GRIEVANCES (IT Rules 2021) ───────────────────────────────────────────────
-- Component 61: grievance redressal workflow
CREATE TABLE IF NOT EXISTS grievances (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id      UUID REFERENCES content_items(id),
  reported_by     UUID REFERENCES users(id),
  contact_email   TEXT NOT NULL,
  issue_type      TEXT NOT NULL,
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'open',   -- open|acknowledged|investigating|resolved|closed
  resolution      TEXT,
  acknowledged_at TIMESTAMPTZ,                    -- must be within 24hr
  resolved_at     TIMESTAMPTZ,                    -- must be within 15 days
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grievances_status ON grievances (status, created_at);

-- ─── JURISDICTION FILTER ─────────────────────────────────────────────────────
-- Component 62: jurisdiction-based legal content filter rules
CREATE TABLE IF NOT EXISTS jurisdiction_rules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country_code  TEXT NOT NULL,
  rule_type     TEXT NOT NULL,    -- block | require_warning | allow
  category      TEXT,
  keyword       TEXT,
  reason        TEXT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (country_code, rule_type, category, keyword)
);

-- Component 63: absolute filter log (child safety — all hits logged permanently)
CREATE TABLE IF NOT EXISTS absolute_filter_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_hash    TEXT NOT NULL,      -- hash of content, never raw content
  filter_type     TEXT NOT NULL,      -- child_safety
  source          TEXT NOT NULL,
  agent           TEXT,
  blocked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── SEO PAGES ───────────────────────────────────────────────────────────────
-- Component 40: SEO page generator tracking
CREATE TABLE IF NOT EXISTS seo_pages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id    UUID NOT NULL REFERENCES content_items(id) ON DELETE CASCADE UNIQUE,
  slug          TEXT NOT NULL UNIQUE,
  meta_title    TEXT,
  meta_desc     TEXT,
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_seo_slug ON seo_pages (slug);

-- ─── COMPLIANCE REPORTS ──────────────────────────────────────────────────────
-- Component 65: monthly compliance report generator
CREATE TABLE IF NOT EXISTS compliance_reports (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_month    DATE NOT NULL UNIQUE,     -- first day of month
  content         JSONB NOT NULL,
  published_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── AD LANDING FLOW ─────────────────────────────────────────────────────────
-- Component 42: ad landing flow — city pre-population tracking
CREATE TABLE IF NOT EXISTS ad_landing_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_token   TEXT NOT NULL UNIQUE,
  city_suggested  TEXT NOT NULL,
  city_confirmed  TEXT,
  ad_source       TEXT NOT NULL DEFAULT 'unknown',  -- discarded after session
  confirmed       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ad_landing_time ON ad_landing_sessions (created_at);

-- ─── CITY DISTRIBUTION AGENT ─────────────────────────────────────────────────
-- Component 41: city distribution agent run log
CREATE TABLE IF NOT EXISTS distribution_runs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city        TEXT NOT NULL,
  channel     TEXT NOT NULL,   -- telegram | whatsapp_channel
  items_sent  INTEGER NOT NULL DEFAULT 0,
  status      TEXT NOT NULL DEFAULT 'pending',
  run_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_distribution_city ON distribution_runs (city, run_at DESC);

COMMIT;
