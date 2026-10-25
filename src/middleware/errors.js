const logger = require('../lib/logger');

function send(res, status, code, message, details) {
  const error = { code, message };
  if (details) error.details = details;
  return res.status(status).json({ error });
}

/**
 * Central error handler. Every branch returns the same JSON shape, and client
 * responses never include stack traces, secrets or database internals.
 */
module.exports = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (error.type === 'entity.parse.failed') {
    logger.warn('request.invalid_json', { ip: req.ip, method: req.method, path: req.originalUrl });
    return send(res, 400, 'INVALID_JSON', 'Request body contains malformed JSON');
  }

  if (error.type === 'entity.too.large') {
    logger.warn('request.payload_too_large', { ip: req.ip, method: req.method, path: req.originalUrl });
    return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if (error.type === 'charset.unsupported' || error.type === 'encoding.unsupported') {
    logger.warn('request.unsupported_encoding', { ip: req.ip, method: req.method, path: req.originalUrl });
    return send(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Request body encoding is not supported');
  }

  if (error.name === 'ValidationError') {
    const details = Object.values(error.errors || {}).map((item) => ({ field: item.path, message: item.message }));
    logger.warn('validation.database_rejected', { path: req.originalUrl, fields: details.map((item) => item.field) });
    return send(res, 400, 'VALIDATION_ERROR', 'Request data is invalid', details);
  }

  if (error.name === 'CastError') {
    logger.warn('request.invalid_id', { ip: req.ip, path: req.originalUrl });
    return send(res, 400, 'INVALID_ID', `Invalid value for ${error.path}`);
  }

  if (error.code === 11000) {
    const fields = Object.keys(error.keyPattern || error.keyValue || {});
    logger.warn('auth.duplicate_account', { fields });
    return send(res, 409, 'DUPLICATE_ACCOUNT', 'Username or email already exists', fields.map((field) => ({
      field,
      message: `That ${field} is already registered`,
    })));
  }

  logger.error('app.unexpected_error', {
    method: req.method,
    path: req.originalUrl,
    name: error.name,
    message: error.message,
    stack: (error.stack || '').split('\n').slice(0, 4).join(' | '),
  });
  return send(res, 500, 'INTERNAL_ERROR', 'Unexpected server error');
};
