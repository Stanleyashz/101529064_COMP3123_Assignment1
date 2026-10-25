const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../lib/logger');
const User = require('../models/User');

function unauthorized(req, res, code, message, event) {
  logger.warn(event, { ip: req.ip, method: req.method, path: req.originalUrl });
  return res.status(401).json({ error: { code, message } });
}

/**
 * Verifies the Bearer JWT, then loads the user so a token for a deleted
 * account cannot be used. req.userId always comes from the verified token;
 * a user ID supplied in the body or query string is never trusted.
 */
module.exports = async function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Bearer ')) {
    return unauthorized(req, res, 'AUTH_REQUIRED', 'Bearer token required', 'auth.missing_token');
  }

  let payload;
  try {
    payload = jwt.verify(header.slice(7), config.jwtSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return unauthorized(req, res, 'TOKEN_EXPIRED', 'Token has expired', 'auth.expired_token');
    }
    return unauthorized(req, res, 'INVALID_TOKEN', 'Token is invalid', 'auth.invalid_token');
  }

  try {
    const user = await User.findById(payload.sub).select('_id username');
    if (!user) {
      return unauthorized(req, res, 'INVALID_TOKEN', 'Token is no longer valid', 'auth.user_missing');
    }
    req.userId = user.id;
    req.username = user.username;
    return next();
  } catch (error) {
    return next(error);
  }
};
