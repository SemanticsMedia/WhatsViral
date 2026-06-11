'use strict';

require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { port, frontend, rateLimit: rl, env } = require('./config/env');
const { healthCheck } = require('./config/database');
const logger = require('./utils/logger');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// ─── Security ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || frontend.allowedOrigins.includes(origin)) return callback(null, true);
    if (env !== 'production') return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ─── Body parsing & compression ──────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: false, limit: '256kb' }));

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', rateLimit({
  windowMs: rl.windowMs,
  max: rl.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// ─── Request logging ──────────────────────────────────────────────────────────
app.use(requestLogger);

// ─── Health check (Railway uses this) ────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const dbTime = await healthCheck();
    res.json({ status: 'ok', db: 'ok', timestamp: dbTime });
  } catch {
    res.status(503).json({ status: 'error', db: 'unavailable' });
  }
});

// ─── API routes ───────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ─── Global error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(port, () => {
  logger.info(`WhatsViral backend started`, { port, env });
  require('./agents').startSchedules();
});

module.exports = app;
