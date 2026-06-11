# WhatsViral (WV) — Complete Project Context for Claude Code

## FOUNDATIONAL PRINCIPLES
- WV is built to last generations. Nothing illegal. Nothing that creates existential risk. Ever.
- WV will not do anything dishonest — not to users, not to platforms, not to investors, not to regulators. Ever.
- These two principles override every other instruction in this file.

---

## WHAT WV IS
A cross-platform, hyper-local content discovery and virality intelligence platform. The default feed shows what is genuinely spreading right now — unfiltered, unmanipulated, ranked purely by ViralScore. No algorithmic personalisation. No echo chambers. No manipulation.

**Core promise:** Open WV and see what everyone around you is actually talking about — not what an algorithm decided you should see. The feed is the same for everyone in your city.

**Global architecture from day one. India-first launch market.**

---

## TECHNICAL STACK
- **Frontend:** React (Netlify hosting, auto-deploy from GitHub)
- **Backend:** Node.js Express (Railway hosting, Asia Pacific region, auto-deploy from GitHub)
- **Database:** Railway PostgreSQL
- **Vector Database:** Pinecone (free tier to start)
- **GitHub repo:** SemanticsMedia/WhatsViral (main branch)
- **Domain:** whatsviral.in (GoDaddy DNS)
- **AI — Consumer:** Google Gemini API (card generation, translate on demand)
- **AI — B2B:** Claude Sonnet (daily digest, crisis narratives, search summaries)
- **Embeddings:** MuRIL + IndicBERT v2 (self-hosted, India-specific language models)
- **Scraping:** Apify (Instagram and TikTok agents)
- **Email delivery:** SendGrid or AWS SES (under $10/month)

---

## API KEYS AND CREDENTIALS
Store all of these as environment variables in Railway. Never hardcode them.

```
YOUTUBE_API_KEY=SET_IN_RAILWAY_ENV
GOOGLE_NEWS_API_KEY=SET_IN_RAILWAY_ENV
GEMINI_API_KEY=SET_IN_RAILWAY_ENV
APIFY_API_KEY=SET_IN_RAILWAY_ENV
REDDIT_CLIENT_ID=pending_approval
REDDIT_CLIENT_SECRET=pending_approval
CLAUDE_API_KEY=pending_billing_resolution
```

Reddit API access has been submitted and is pending approval. Build without it for now — slot it in when approved. Claude API has a billing issue — using Gemini as replacement for consumer features during beta.

---

## LAUNCH STRATEGY
**No metro launch. Semi-urban first.**

20 cities across 5 regions:
- North: Lucknow, Jaipur, Chandigarh, Agra
- West: Surat, Nagpur, Vadodara, Nashik
- South: Coimbatore, Kochi, Visakhapatnam, Mysuru
- East: Patna, Bhubaneswar, Guwahati, Ranchi
- Central: Indore, Bhopal, Raipur, Varanasi

Target milestone before investor conversations: 10,000 real active users across launch cities plus 1-2 paying B2B clients.

---

## BUILD SEQUENCE
Build in this order. Do not skip phases.

### Phase 1 — Backend Foundation
All agents, ViralScore engine, data architecture, B2B intelligence layer. Nothing visible to users yet but everything working and tested.

### Phase 2 — Consumer Frontend
Complete consumer product connected to live backend. All 20 cities. Landing page, feed, search, all features.

### Phase 3 — B2B Product
B2B dashboard and all four products on same backend.

### Phase 4 — Polish and Test
Every city, every agent, every search, every B2B feature. Fix everything. Achieve the 60-second wow moment consistently.

### Phase 5 — Targeted Semi-Urban Launch
Deliberate introduction to specific communities in 20 cities. Personal, not broadcast.

---

## VIRAL∞ SCORE ENGINE

Scores every piece of content 0-100 in real time.

| Signal | Weight | What it measures |
|--------|--------|-----------------|
| Cross-platform presence | 25pts | Appearing on 2+ sources simultaneously |
| Velocity | 20pts | Acceleration last 2hrs vs last 6hrs |
| Engagement quality | 20pts | Comments and shares weighted above views |
| Geographic spread | 15pts | Crossing cities organically |
| Source diversity | 10pts | Multiple categories amplifying |
| Breakout factor | 10pts | Small/unknown source, outsized spread |
| Decay curve | -0 to -20pts | Fresh scores higher, decays over 48hrs |
| AI-generated flag | Label only | Shown on card, never affects score |

### Three tech moat layers — build foundations from day one:
1. **Dynamic weight learning** — weights adjust by city, category, time, content type based on real outcomes
2. **Predictive virality** — identifies content before it goes viral (meaningful after 6-12 months live data)
3. **Cross-platform pattern library** — how virality bleeds across platforms (defensible after 18-24 months)

### Data architecture for moat — must be in from day one:
- Virality outcome tracking — track content for 48hrs after surfacing
- Cross-platform co-occurrence logging — log timing and sequence when content appears across platforms
- Campaign event tagging — tag B2B campaign keywords and track
- All stored anonymised and aggregated permanently

### Content freshness — three states only:
- **Breaking:** 0-2 hours, accelerating
- **Rising:** 2-12 hours, climbing
- **Viral:** 12-48 hours, peak or near-peak
- Fading content exits consumer feed entirely. Lives only in B2B analytics.

---

## AGENT STACK (12 agents, all V1)

| Agent | Platform | Type | Speed | Weight |
|-------|----------|------|-------|--------|
| YouTube | YouTube | Direct API | Real-time | Full |
| Google Trends | Google Trends | Direct | Real-time | Full |
| Reddit | Reddit | Direct API | Real-time | Full (pending approval) |
| Google News | Google News | Direct API | Real-time | Full |
| Telegram | Public channels | Direct | Real-time | Full |
| Instagram | Apify | Managed | ~1hr lag | 80% |
| TikTok | Apify | Managed | ~1hr lag | 80% |
| LinkedIn | Shadow + enhanced public | Indirect | 30-60min | 50% |
| ShareChat | Shadow signals | Indirect | 2-6hr lag | 50% |
| OTT Signals | YouTube + Reddit + News | Shadow | 2-4hr lag | 40% |
| Podcast | Google + YouTube | Shadow | 2-4hr lag | 40% |
| WhatsApp Submissions | User-generated | Crowdsourced | Real-time | 30% human verified |

**LinkedIn B2B enhancement:** Company page engagement velocity, industry hashtag feeds, Google index of LinkedIn content. Detection time 30-60 minutes.

---

## FEED ARCHITECTURE

### Infinite scroll — two axes simultaneously:
- **Geographic cascade:** City → State → Region → National → Global. Invisible. Never announced. Never empty.
- **Minimum feed depth:** 15 city items before cascade activates. Silent fill to minimum 30 items.

### 10-card set composition (repeating unit, not a limit):
- Cards 1-2: Breaking local — highest urgency, city-level
- Cards 3-4: Rising — user sees before it peaks
- Cards 5-7: Viral — cross-platform confirmed
- Card 8: Breakout moment — unexpected source, outsized spread
- Card 9: Local discovery — hyper-local, city-specific
- Card 10: Cascade wildcard — next geographic level

No two consecutive cards same format or emotional register. Variety engineered into sequence.

### Content demotion — three tiers:
- Tier 1: Unseen content — always first
- Tier 2: Seen but still actively viral — demoted, promoted back if updated significantly (score delta 15+ points)
- Tier 3: Seen and plateau/decaying — end of scroll

### Session timing — four profiles by time of day:
- Morning: Breaking heavy, fast scannable
- Midday: Mixed viral and rising
- Evening: Entertainment-oriented, longer form
- Late night: Exploratory, global cascade

### "You saw this first" mechanic:
Seen-content log stores ViralScore at view time. When Rising content user saw subsequently peaks — trigger notification "Something you saw first is now everywhere."

---

## USER ACCOUNTS

**Consumer:** Optional, prompted after first value moment. Google and Apple OAuth only. One tap. Never blocking.

**B2B:** Mandatory. Standard SaaS login.

**Authentication options:**
- Sign in with Google (Android and web)
- Sign in with Apple (iOS — required by App Store)

OAuth scope — minimum only: unique account ID, display name, email. Never request platform permissions beyond basic profile.

**Account deletion:** One tap. Immediate. All personal data deleted. Aggregate anonymised signals retained.

---

## CREATOR LAYER
Every content card shows:
- Creator name and platform icon
- One-line descriptor from profile bio
- Viral count — how many times appeared on WV (proprietary WV signal)
- Follow button — deep link to native platform. WV facilitates, never owns the follow.

---

## SOCIAL LAYER
- **V1:** No social features. Pure discovery.
- **V2:** Two reactions only — "Didn't know this" and "Worth sharing." Both positive, both feed ViralScore, neither suppresses content.
- **V2:** Creator follows via OAuth. Notification intelligence only.
- **Permanently off the table:** City conversations, downvotes, like/dislike buttons, follower counts displayed publicly, reply threads, direct messaging, creator monetisation through WV, algorithmic feed influenced by social graph.

---

## SHAREABLE CARDS
Every card pre-generates a data package at fetch time:
- Content title
- ViralScore snapshotted at share moment (not current score)
- City tag
- Platform indicators array
- Content category
- Canonical deep link to original platform
- WV share link: whatsviral.in/v/[content-id]

Share links persist for 72 hours then gracefully redirect to city feed.

Card design language: "Trending in Nagpur • ViralScore 87 • whatsviral.in" — beautiful on WhatsApp.

---

## LOCATION AND PRIVACY
- City level only. GPS coordinates processed on device, never sent to server.
- WV never sees coordinates — only city name.
- User-facing language: "We use your location to show you what's really viral around you. You can delete this anytime in settings."
- Active users: city preference retained continuously.
- Inactive users: 30 days without session triggers automatic deletion.
- Aggregate data: anonymised immediately, retained permanently.

---

## CONTENT PHILOSOPHY AND FILTERS

**Consumer:** Jurisdiction-based legal filter only. If it's legal where you are, you see it. No human editorial judgment. Ever.

**B2B:** Client-configured parameters. Client makes their own decisions. WV executes. Clients cannot suppress factually accurate third-party information.

**Absolute filter — no exceptions, no overrides, ever:** Child safety content.

**"Seems Promoted" flag — three tiers:**
- Free consumer: binary flag only. "Virality pattern unusual." Never paywalled.
- Consumer paid: platform breakdown, organic vs coordinated %, confidence detail. ₹99-199/month.
- B2B: full competitive intelligence. ₹20,000-50,000/month.

Trigger conditions (three or more simultaneously):
- Velocity anomaly — spike with no warm-up
- Engagement ratio anomaly — views/shares disproportionate to comments
- Geographic concentration — unusual spread pattern
- Account pattern anomaly — new, inactive, or homogeneous accounts
- Cross-platform simultaneity — appearing across platforms in same narrow window

**Misinformation — community report mechanism:**
- Report button on every card: False/Misleading, Harmful, Spam, Other
- Dynamic threshold: 1% of users who saw the content, minimum 100 reports
- Brigading detection: spikes from new or geographically concentrated accounts discounted
- Flag: "847 users flagged this as potentially false" — community signal not WV judgment
- ViralScore impact: maximum 10 point downward adjustment. Never removes content.

---

## MULTILINGUAL — V1 FROM DAY ONE

**Six languages at launch:** Hindi, Marathi, Tamil, Malayalam, Telugu, English

**Three language layers — independent of each other:**
1. Interface language: set at signup in native script, all WV elements always in this language
2. Content card: WV-generated summary in user's interface language — generated on demand, cached permanently. Gemini API for free users, Claude Sonnet for B2B.
3. Translate on demand: card level and content level, user-initiated, never automatic

**Signup flow:** City confirmation → Language selection in native script → Feed loads in selected language

Show language options in native script: हिंदी / मराठी / தமிழ் / മലയാളം / తెలుగు / English

**All interface strings in language files, never hardcoded.** Adding a new language = translation task, not a development task.

**Language roadmap:**
- V2: Bengali, Kannada, Gujarati, Punjabi, Odia, Urdu
- V3: Southeast Asia (Bahasa, Thai, Vietnamese, Filipino), LATAM (Portuguese, Spanish)
- V4: Arabic, Swahili, French, German

---

## EMBEDDINGS ARCHITECTURE

**Two models, hybrid routing, fully self-hosted on Railway:**

**MuRIL** (Google, Apache 2.0 licence)
- Use for: social media content, informal text, code-mixed language, transliterated content (Hinglish, Tanglish)
- 17 Indian languages, explicitly trained on transliteration

**IndicBERT v2** (AI4Bharat/IIT Madras, MIT licence)
- Use for: formal content — news articles, Google News, LinkedIn, formal Reddit posts
- 24 Indian languages, trained on 20.9 billion tokens, actively maintained

Both are commercially licensed (Apache 2.0 / MIT). Both self-hosted — WV content never leaves WV infrastructure.

**Routing logic:**
- Social media content → MuRIL
- Formal content → IndicBERT v2
- Mixed content → MuRIL (informal handling takes priority)

**Model versioning from day one:** Every embedding tagged with model name and version. Migration = background process, never a service interruption.

**Vector database:** Pinecone free tier (V1), self-hosted Qdrant at scale.

---

## B2B PRODUCTS

### Brand Pulse
Real-time brand and competitive intelligence. ViralScore for tracked brands and competitors. Velocity graph. Organic vs promoted split. Platform breakdown. City-level spread. Sentiment signals. Competitor overlay. Global search worldwide.
Price: ₹25,000/month entry, ₹50,000/month growth, ₹1,00,000/month enterprise.

### Campaign Intelligence
Included in Brand Pulse Growth and Enterprise. Campaign tracking from launch. Organic spread detection. City adoption sequence. Predicted trajectory. Competitor comparison. Global inspiration search.

### Crisis Radar — always-on, every paid B2B tier
Not a separate product — table stakes. Baseline profiling per tracked brand. Alerts fire on deviation from baseline, not absolute thresholds. 7am daily alert regardless. Negative sentiment velocity alerts. Authenticity Score on negative content. Narrative summary via Claude Sonnet (3-sentence brief). Response window indicator.

### Creator Intelligence
Consistent viral creators by category and city. Actual virality not follower count. Organic vs promoted signal. Cross-platform spread pattern. Authenticity score.
Price: ₹15,000/month entry, ₹30,000/month growth, ₹60,000/month enterprise.

### Free Journalist Tier — permanently free
Early Signals feed. Verified media email required. Self-serve. WV citations in stories = PR value exceeds subscription revenue. Deliberate strategy.

### Daily Digest — all paid B2B tiers
AI-generated via Claude Sonnet. 90 seconds to read. Delivered 7am local time. Contains: overnight brand/competitor summary, top 3 rising items in category, city with highest brand traction, week-on-week ViralScore trend, one "watch this" alert, global inspiration. Email via SendGrid/SES. One tap from digest opens relevant dashboard section.

### Global Search
Brand, category, campaign keywords searchable worldwide. Geographic and temporal filters. One-line English summary of non-English content via Claude Sonnet.

### Brand Entity Database
V1: Google Knowledge Graph API + Wikidata + Open Food Facts. Free, 3-4 days integration.
Month 6+: WV proprietary virality data enriches and replaces progressively.

### B2B Sentiment — four signals:
1. Virality sentiment: why is this going viral? (positive enthusiasm / negative outrage / controversy / curiosity)
2. Brand sentiment velocity: trajectory more actionable than absolute number
3. Narrative clustering: distinct conversation threads each with own sentiment
4. Geographic sentiment variance: regional differences critical in India

Confidence indicators on every signal: English = high, Hindi = medium-high, regional = medium.

### B2B Pricing
| Product | Entry | Growth | Enterprise |
|---------|-------|--------|------------|
| Brand Pulse | ₹25,000/month | ₹50,000/month | ₹1,00,000/month |
| Creator Intelligence | ₹15,000/month | ₹30,000/month | ₹60,000/month |
| Bundle discount | 20% on 2nd | 30% on 3rd | Custom |

Crisis Radar and Daily Digest included in all paid tiers.

---

## RUNNING COSTS

| Item | Monthly |
|------|---------|
| Railway Asia Pacific | $5 |
| Apify | $49 |
| Claude Sonnet (B2B, 100 clients) | $501 |
| Gemini API (consumer) | ~$19 at 10K DAU |
| Embeddings (MuRIL + IndicBERT v2) | ~$10 |
| Pinecone | $0 free tier |
| Email delivery | $10 |
| Domain | ~$0.13 |
| **Total at V1 scale** | **~$594/month** |

One B2B client at entry pricing covers all infrastructure costs except AI. Three B2B clients covers everything.

---

## DESIGN PRINCIPLES
- Dark by default
- Typography-led, not image-led
- ViralScore as primary visual element on every card
- Speed as design feature — no spinners, no skeleton screens, no loading messages
- Generous whitespace — restraint as confidence
- ViralScore colour system: Breaking / Rising / Viral visually distinct
- Shareable cards look beautiful on WhatsApp
- Language selection shown in native script
- Must never feel built for metros — designed for Nagpur and Coimbatore first

---

## GROWTH LOOP

### How users arrive:
- Targeted hyperlocal ads in local language (curiosity and FOMO driven, city-specific creative)
- WhatsApp forwarding of shareable viral cards
- Automated city Telegram and WhatsApp Channels (agent-managed, zero human involvement post-setup)
- SEO — every content item a crawlable indexed page at whatsviral.in/v/[content-id]
- Word of mouth

### Ad landing experience:
City pre-populated from ad targeting context. Warm popup: "You're in Nagpur. Ready to see what's viral there right now?" Feed pre-loads during popup display. Zero perceived loading time. Ad source discarded after session — only confirmed city stored.

### Notifications:
Ask on first open with specific local value proposition: "Get notified the moment something goes viral in Nagpur. Be the first to know."
Denied → re-ask after 30 days with missed-content framing. Never more frequent than 30 days.

### City Distribution Agent:
Automated. Posts top 5 ViralScore items daily to each city's Telegram channel and WhatsApp Channel. Zero human involvement post-setup.

### Session frequency target:
3-5 opens per day. 6-8 minutes per session. DAU/MAU 40-45%.

### The one retention metric that matters:
Does the user find something genuinely new and surprising in the first 60 seconds of every session? Yes = they return. No = they don't. Everything in the build serves this outcome.

---

## REGULATORY AND LEGAL

### India — IT Rules 2021:
- Grievance redressal: report button feeds timestamped workflow, 24hr acknowledgment, 15-day resolution
- Grievance Officer: owner at launch, named publicly
- Monthly compliance reports: published publicly
- 5 million user SSMI threshold: architecture designed for compliance before reaching it

### Infrastructure:
Railway Asia Pacific. Stateless backend — data layer independently moveable for localisation compliance.

### Market expansion priority:
| Market | Timeline |
|--------|----------|
| India | Now — V1 |
| Southeast Asia | V2 |
| UK | V2 |
| EU | V2-V3 |
| Brazil/US | V3 |
| China/Russia | Skip permanently |

### Data legal positioning:
- Official APIs: primary approach. Clean, contractual, protected.
- Apify for Instagram/TikTok: accepted grey area at V1, explicit plan to convert at scale.
- Shadow signals: aggregate topics only, not individual profiles. Documented distinction.
- **One legal consultation required before B2B goes live.** One hour, startup IP lawyer. Covers consumer privacy, B2B data product legality, platform ToS positioning. Non-negotiable.

---

## THE MOAT

### What makes WV defensible:
1. Data asset — proprietary cross-platform virality data, meaningful after 12-18 months
2. Authenticity Score — cross-platform manufactured virality detection, no single platform sees what WV sees
3. Hyper-local city intelligence — content patterns at city level for Tier 2/3 India
4. B2B relationships — switching costs from campaign history, grows with each client
5. Trust moat — no financial incentive to manipulate feed. Google and Meta structurally cannot make this claim.
6. Client data flywheel — more clients = better predictions = more clients

### Moat timeline (with India-specific embeddings compression):
| Moat | Real from |
|------|-----------|
| B2B relationships | Month 1 |
| India depth | Day 1 |
| Early data patterns | Month 4-5 |
| Data asset meaningful | Month 10-14 |
| Predictive virality | Month 10-14 |
| Cross-platform patterns | Month 14-18 |
| Full tech moat | Month 18-20 |

---

## COMPLETE BACKEND COMPONENT LIST
Build all of these. Do not skip any.

**Core infrastructure:**
1. Railway Asia Pacific backend — Node.js Express
2. GitHub SemanticsMedia/WhatsViral — auto-deploy on push
3. Netlify frontend — global CDN, auto-deploy
4. Stateless backend — data layer independently moveable

**Agent layer:**
5. YouTube Agent — direct API
6. Google Trends Agent — direct
7. Reddit Agent — direct API (pending approval, build stub)
8. Google News Agent — direct API
9. Telegram Agent — public channels
10. Instagram Agent — Apify
11. TikTok Agent — Apify
12. LinkedIn Agent — shadow + enhanced public monitoring
13. ShareChat Agent — shadow signals
14. OTT Signal Agent — cross-platform shadow
15. Podcast Agent — YouTube + Google shadow
16. WhatsApp Submission handler — user-generated

**Scoring and intelligence:**
17. ViralScore engine — dynamic weights, tiered confidence
18. Authenticity Score engine — cross-platform pattern detection
19. Feed composer — sequencing and set composition
20. Content tagging — format and emotional register per item
21. Session timing profiles — four time-of-day compositions
22. Virality outcome tracker — 48hr post-surfacing tracking
23. Cross-platform co-occurrence logger
24. Campaign event tagger

**Embeddings and semantic layer:**
25. MuRIL instance — social media and informal content
26. IndicBERT v2 instance — formal content
27. Embeddings routing service — content type classification and model routing
28. Vector database — Pinecone V1
29. Model versioning system — every embedding tagged with model and version

**User layer:**
30. Account service — Google and Apple OAuth
31. Seen-content log — device and account level, 30-day retention
32. Content demotion engine — three-tier ranking with update detection
33. Saved creators — device level V1
34. Creator profile cache — ID, bio, viral count, platform URL
35. Notification service — "you saw this first", city alerts, crisis alerts

**Content layer:**
36. Content ID system — persistent unique identifiers
37. Share link generator — 72-hour persistence, graceful redirect
38. Viral cluster tagger — co-occurrence within 6-hour window
39. Shareable card generator — data package pre-generated at fetch time
40. SEO page generator — crawlable per content item

**Growth layer:**
41. City distribution agent — automated Telegram and WhatsApp posting
42. Ad landing flow — city pre-population, popup confirmation
43. Smart link handler — connection speed detection, lite routing

**Language layer:**
44. Language detection and selection — device-based auto-detect
45. Card generation service — on-demand, language-specific, aggressive caching
46. Entity and topic extraction — multilingual search processing
47. Translate on demand — card and content level, user-initiated only
48. AI service wrapper — provider-agnostic, B2B and consumer separate configurations
49. Cost monitoring dashboard — real-time AI API usage and costs

**B2B layer:**
50. Brand entity database — Google Knowledge Graph + Wikidata + Open Food Facts
51. Brand Pulse service — real-time brand and competitive intelligence
52. Campaign Intelligence service — tracking, trajectory, prediction
53. Crisis Radar service — baseline profiling, deviation detection, alerts
54. Creator Intelligence service — viral frequency, category, city breakdown
55. Daily digest generator — AI-generated, scheduled 6am, delivered 7am
56. Global search service — worldwide query, geographic and temporal filters
57. Sentiment analysis service — four signals, confidence indicators
58. Narrative summary generator — Claude Sonnet
59. Email delivery — SendGrid or AWS SES
60. B2B dashboard API — separate from consumer API

**Data and compliance:**
61. Grievance redressal workflow — timestamped, 24hr acknowledgment, 15-day resolution
62. Jurisdiction filter — legal content by user location
63. Child safety filter — absolute, no exceptions, no overrides
64. Content moderation pipeline — Perspective API first layer
65. Monthly compliance report generator
66. Privacy data deletion service — one tap, immediate, confirmed

---

## WHAT REMAINS BEFORE B2B GOES LIVE
- One legal consultation — consumer privacy, B2B data product legality, platform ToS. Non-negotiable before B2B launch.
- Reddit API approval — submitted, awaiting response. Build stub now, activate when approved.
- Claude API billing — resolve Anthropic billing issue when possible, swap in for Gemini.

---

## AI PROVIDER ARCHITECTURE
Provider-agnostic wrapper from day one. B2B and consumer on separate configurations. Each switchable independently with one config change.

- **B2B:** Claude Sonnet. No compromise. No cost-cutting. Ever. Best available model regardless of scale.
- **Consumer:** Gemini API (free tier during beta), upgrade path to Claude Haiku when billing resolved.

Switch triggers:
- Consumer switches to open source self-hosted when monthly consumer AI cost exceeds $500
- B2B stays on best available model at any scale — cost never exceeds 2% of B2B revenue

---

## LITE MODE
**Decision: No separate lite mode. Ever.**

WV's typography-led, text-first, no hosted video, no autoplay design is inherently data-light (~8-12MB per session vs 50-100MB for Instagram). Semi-urban users on 3G who manage Instagram manage WV comfortably.

One addition — smart link handling: detect connection speed on deep link tap, route to lightest available destination on slow connections. Transparent to user.

---

## ADVERTISING OPTIONALITY

**Current status: Advertising is OFF. WV launches with zero ads. This is a core product principle.**

WV's business model is B2B subscriptions and paid consumer tiers — not advertising. The trust moat depends on having no financial incentive to manipulate the feed. Ads must never be activated without a conscious, deliberate decision by the owner.

**However: build the feed composer with monetisation slots flagged from day one.**

This is a structural decision that costs one afternoon now and saves weeks of work if investors later require an ad revenue option. The principle: reserve the architecture, never activate it until chosen.

### How to implement this:

In the feed composer (component #19 in the backend list), every 10-card set has a `card_10` position currently defined as "cascade wildcard." Build this position with a `slot_type` config field:

```javascript
// Feed slot configuration
const SLOT_CONFIG = {
  card_10: {
    slot_type: 'organic', // Options: 'organic' | 'monetisable'
    current_content: 'cascade_wildcard',
    // When slot_type is 'monetisable', this position can serve
    // a paid placement instead of organic content.
    // NEVER change slot_type without owner instruction.
  }
}
```

Additional monetisable positions if ever needed: card_20 of every second set, and a dedicated "Sponsored" card that can be inserted between sets. None of these are active at launch.

### What "monetisable slot" means in practice:
- slot_type: 'organic' — always shows organic viral content. Default. What WV launches with.
- slot_type: 'monetisable' — position can serve either organic content OR a paid placement depending on whether an ad is available. Falls back to organic if no ad exists.

### Rules that must never be violated regardless of investor pressure:
1. Ads never affect ViralScore. Ever.
2. Ads are always visually labelled "Sponsored" — never disguised as organic content.
3. Ads never appear in Breaking or Rising positions (cards 1-4). Only in organic cascade positions.
4. Ad content still passes through jurisdiction filter and child safety filter. No exceptions.
5. The number of monetisable slots never exceeds 1 per 10-card set (10% of feed maximum).
6. Activating any monetisable slot requires explicit owner instruction — never done autonomously.

### What is NOT built now:
- No ad server integration
- No advertiser dashboard
- No targeting system
- No ad auction logic
- No tracking pixels

These are built only if and when the owner decides to activate advertising. The slot architecture simply ensures the feed composer won't need to be rebuilt from scratch if that day comes.

### Why this approach protects WV:
If investors ask "can you monetise with ads?" — the answer is yes, the architecture supports it, activation takes weeks not months. If investors never ask — WV launches and runs exactly as designed, with zero ads, forever. The slot config sits dormant and irrelevant.

---

## IMPORTANT NOTES FOR CLAUDE CODE
- Always ask before deleting any existing files in the repo
- The existing repo has old v8 frontend code — replace it, do not build on top of it
- Every environment variable goes in Railway, never hardcoded in any file
- Test every agent independently before integrating into the ViralScore engine
- The 60-second wow moment is the most important product metric — every build decision serves it
- When in doubt about any product decision, refer back to the foundational principles at the top of this file
- The SLOT_CONFIG in the feed composer must default to slot_type: 'organic' for all positions. Never change this without explicit owner instruction.
- Never activate advertising features autonomously. Ever.
