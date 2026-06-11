'use strict';

require('dotenv').config();

function required(name) {
  const val = process.env[name];
  if (!val && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val || '';
}

function optional(name, defaultValue = '') {
  return process.env[name] || defaultValue;
}

module.exports = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),
  apiBaseUrl: optional('API_BASE_URL', 'http://localhost:3000'),

  db: {
    url: required('DATABASE_URL'),
    poolMax: parseInt(optional('DATABASE_POOL_MAX', '20'), 10),
    poolIdleTimeout: parseInt(optional('DATABASE_POOL_IDLE_TIMEOUT', '30000'), 10),
  },

  agents: {
    youtubeApiKey: required('YOUTUBE_API_KEY'),
    googleNewsApiKey: required('GOOGLE_NEWS_API_KEY'),
    apifyApiKey: required('APIFY_API_KEY'),
    redditClientId: optional('REDDIT_CLIENT_ID'),
    redditClientSecret: optional('REDDIT_CLIENT_SECRET'),
  },

  ai: {
    geminiApiKey: required('GEMINI_API_KEY'),
    claudeApiKey: optional('CLAUDE_API_KEY'),
    consumer: {
      provider: optional('AI_CONSUMER_PROVIDER', 'gemini'),
    },
    b2b: {
      provider: optional('AI_B2B_PROVIDER', 'claude'),
    },
  },

  pinecone: {
    apiKey: required('PINECONE_API_KEY'),
    environment: optional('PINECONE_ENVIRONMENT', 'gcp-starter'),
    indexName: optional('PINECONE_INDEX_NAME', 'whatsviral-content'),
  },

  email: {
    sendgridApiKey: required('SENDGRID_API_KEY'),
    from: optional('EMAIL_FROM', 'noreply@whatsviral.in'),
    fromName: optional('EMAIL_FROM_NAME', 'WhatsViral'),
  },

  auth: {
    jwtSecret: required('JWT_SECRET'),
    jwtExpiresIn: optional('JWT_EXPIRES_IN', '7d'),
    googleOAuthClientId: optional('GOOGLE_OAUTH_CLIENT_ID'),
    googleOAuthClientSecret: optional('GOOGLE_OAUTH_CLIENT_SECRET'),
    appleOAuthClientId: optional('APPLE_OAUTH_CLIENT_ID'),
    appleOAuthTeamId: optional('APPLE_OAUTH_TEAM_ID'),
    appleOAuthKeyId: optional('APPLE_OAUTH_KEY_ID'),
    appleOAuthPrivateKey: optional('APPLE_OAUTH_PRIVATE_KEY'),
  },

  frontend: {
    url: optional('FRONTEND_URL', 'https://whatsviral.in'),
    allowedOrigins: optional('ALLOWED_ORIGINS', 'https://whatsviral.in').split(','),
  },

  rateLimit: {
    windowMs: parseInt(optional('RATE_LIMIT_WINDOW_MS', '900000'), 10),
    maxRequests: parseInt(optional('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },

  embeddings: {
    murilServiceUrl: optional('MURIL_SERVICE_URL', 'http://muril:8080'),
    indicbertServiceUrl: optional('INDICBERT_SERVICE_URL', 'http://indicbert:8080'),
  },

  moderation: {
    perspectiveApiKey: optional('PERSPECTIVE_API_KEY'),
  },

  logging: {
    level: optional('LOG_LEVEL', 'info'),
  },
};
