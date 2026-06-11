'use strict';

const cron = require('node-cron');
const logger = require('../utils/logger');

const agents = {
  youtube:      require('./youtube'),
  googleTrends: require('./googleTrends'),
  googleNews:   require('./googleNews'),
  reddit:       require('./reddit'),
  telegram:     require('./telegram'),
  instagram:    require('./instagram'),
  tiktok:       require('./tiktok'),
  linkedin:     require('./linkedin'),
  sharechat:    require('./sharechat'),
  ott:          require('./ott'),
  podcast:      require('./podcast'),
  whatsapp:     require('./whatsapp'),
};

const status = {};
for (const name of Object.keys(agents)) {
  status[name] = { lastRun: null, lastError: null, running: false, itemsLastRun: 0 };
}

async function runAgent(name) {
  const agent = agents[name];
  if (!agent) throw new Error(`Unknown agent: ${name}`);
  if (status[name].running) return { skipped: true, reason: 'already running' };

  status[name].running = true;
  const start = Date.now();
  try {
    const result = await agent.run();
    status[name].lastRun = new Date();
    status[name].lastError = null;
    status[name].itemsLastRun = result.count || 0;
    logger.info(`Agent ${name} completed`, { duration: Date.now() - start, items: result.count });
    return result;
  } catch (err) {
    status[name].lastError = err.message;
    logger.error(`Agent ${name} failed`, { error: err.message });
    throw err;
  } finally {
    status[name].running = false;
  }
}

function getStatus() {
  return Object.entries(status).map(([name, s]) => ({ name, ...s }));
}

function startSchedules() {
  // Real-time agents: every 5 minutes
  for (const name of ['youtube', 'googleTrends', 'googleNews', 'telegram']) {
    cron.schedule('*/5 * * * *', () => runAgent(name).catch(() => {}));
  }

  // Apify agents: every 60 minutes (~1hr lag per spec)
  for (const name of ['instagram', 'tiktok']) {
    cron.schedule('0 * * * *', () => runAgent(name).catch(() => {}));
  }

  // Shadow agents: every 30 minutes
  for (const name of ['linkedin', 'sharechat']) {
    cron.schedule('*/30 * * * *', () => runAgent(name).catch(() => {}));
  }

  // Composite shadow agents: every 2 hours
  for (const name of ['ott', 'podcast']) {
    cron.schedule('0 */2 * * *', () => runAgent(name).catch(() => {}));
  }

  // Reddit: stub — does nothing until API approved
  cron.schedule('*/5 * * * *', () => runAgent('reddit').catch(() => {}));

  logger.info('Agent schedules started');
}

module.exports = { runAgent, getStatus, startSchedules };
