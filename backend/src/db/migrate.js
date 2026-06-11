'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function migrate() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    logger.info('Running schema migration...');
    await client.query(sql);
    logger.info('Schema migration complete.');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => {
  logger.error('Migration failed', { error: err.message });
  process.exit(1);
});
