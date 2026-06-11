'use strict';

const logger = require('../utils/logger');
const { env } = require('../config/env');

module.exports = function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  logger.error('Unhandled error', {
    message: err.message,
    path: req.path,
    method: req.method,
    status,
    stack: env !== 'production' ? err.stack : undefined,
  });

  res.status(status).json({
    error: status < 500 ? err.message : 'Internal server error',
    ...(env !== 'production' && { stack: err.stack }),
  });
};
