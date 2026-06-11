'use strict';

const fs = require('fs');
const path = require('path');
const { pool } = require('../config/database');
const logger = require('../utils/logger');

async function seed() {
  const client = await pool.connect();
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'seed_cities.sql'), 'utf8');
    logger.info('Seeding cities and default weights...');
    await client.query(sql);
    const result = await client.query('SELECT COUNT(*) FROM cities');
    logger.info(`Seed complete — ${result.rows[0].count} cities in database.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => {
  logger.error('Seed failed', { error: err.message });
  process.exit(1);
});
