'use strict';

const { Pool } = require('pg');
const { db } = require('./env');
const logger = require('../utils/logger');

const pool = new Pool({
  connectionString: db.url,
  max: db.poolMax,
  idleTimeoutMillis: db.poolIdleTimeout,
  connectionTimeoutMillis: 5000,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL pool error', { error: err.message });
});

async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      logger.warn('Slow query detected', { duration, query: text.substring(0, 80) });
    }
    return result;
  } catch (err) {
    logger.error('Database query error', { error: err.message, query: text.substring(0, 80) });
    throw err;
  }
}

async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query.bind(client);
  client.query = (...args) => {
    client.lastQuery = args;
    return originalQuery(...args);
  };
  return client;
}

async function transaction(fn) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function healthCheck() {
  const result = await query('SELECT NOW() as now');
  return result.rows[0].now;
}

module.exports = { query, getClient, transaction, healthCheck, pool };
