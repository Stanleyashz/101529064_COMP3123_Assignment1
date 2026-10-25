const { rateLimit } = require('express-rate-limit');
const config = require('../config');
const logger = require('../lib/logger');

/**
 * A 429 response that matches the rest of the API's error shape.
 * Retry-After is set by express-rate-limit's standard headers.
 */
function limitExceeded(req, res) {
  logger.warn('security.rate_limit_exceeded', {
    ip: req.ip,
    method: req.method,
    path: req.originalUrl,
  });
  res.status(429).json({
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please wait and try again.',
      retry_after_seconds: Math.ceil(config.rateLimitWindowMs / 1000),
    },
  });
}

const shared = {
  windowMs: config.rateLimitWindowMs,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitExceeded,
};

/** Protects signup and login against credential-stuffing and signup spam. */
const authLimiter = rateLimit({ ...shared, limit: config.authRateLimitMax });

/** Baseline protection for every API route. */
const apiLimiter = rateLimit({ ...shared, limit: config.apiRateLimitMax });

module.exports = { authLimiter, apiLimiter };
