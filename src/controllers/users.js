const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../lib/logger');
const { validateSignup, validateLogin } = require('../lib/validation');
const userService = require('../services/users');

function validationError(req, res, action, errors) {
  logger.warn(`validation.${action}_failed`, {
    ip: req.ip,
    path: req.originalUrl,
    fields: errors.map((item) => item.field),
  });
  return res.status(400).json({
    error: { code: 'VALIDATION_ERROR', message: 'Request data is invalid', details: errors },
  });
}

async function signup(req, res, next) {
  const { errors, value } = validateSignup(req.body);
  if (errors.length) return validationError(req, res, 'signup', errors);

  try {
    const user = await userService.createUser(value);
    logger.info('auth.signup_success', { userId: user.id });
    return res.status(201).json({ message: 'Account created', user: userService.toPublicUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      const fields = Object.keys(error.keyPattern || error.keyValue || {});
      logger.warn('auth.signup_duplicate', { ip: req.ip, fields });
      return res.status(409).json({
        error: {
          code: 'DUPLICATE_ACCOUNT',
          message: 'Username or email already exists',
          details: fields.map((field) => ({ field, message: `That ${field} is already registered` })),
        },
      });
    }
    return next(error);
  }
}

async function login(req, res, next) {
  const { errors, value } = validateLogin(req.body);
  if (errors.length) return validationError(req, res, 'login', errors);

  try {
    const user = await userService.verifyCredentials(value);
    if (!user) {
      logger.warn('auth.login_failed', {
        ip: req.ip,
        identifier: value.username ? 'username' : 'email',
      });
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } });
    }

    if (!config.jwtSecret) throw new Error('JWT_SECRET is not configured');
    const token = jwt.sign({ username: user.username }, config.jwtSecret, {
      subject: user.id,
      expiresIn: config.jwtExpiresIn,
    });

    logger.info('auth.login_success', { userId: user.id });
    return res.json({
      message: 'Login successful',
      token,
      token_type: 'Bearer',
      expires_in: config.jwtExpiresIn,
      user: userService.toPublicUser(user),
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { signup, login };
