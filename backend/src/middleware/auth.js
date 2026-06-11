'use strict';

const jwt = require('jsonwebtoken');
const { auth } = require('../config/env');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    req.user = jwt.verify(header.slice(7), auth.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function authenticateB2B(req, res, next) {
  authenticate(req, res, () => {
    if (!req.user || req.user.accountType !== 'b2b') {
      return res.status(403).json({ error: 'B2B account required' });
    }
    next();
  });
}

function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), auth.jwtSecret);
    } catch {
      // Continue without user — consumer auth is optional
    }
  }
  next();
}

module.exports = { authenticate, authenticateB2B, optionalAuth };
