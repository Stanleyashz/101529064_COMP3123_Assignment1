const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const logger = require('./lib/logger');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// Vercel and other hosted platforms put a proxy in front of the app.
// Trusting exactly one hop lets express-rate-limit and req.ip see the real client.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// Helmet sets sensible security headers such as X-Content-Type-Options,
// X-Frame-Options, Referrer-Policy and a Content-Security-Policy.
app.use(helmet());

app.use(
  morgan(':method :url :status :res[content-length] - :response-time ms', {
    stream: { write: (line) => logger.info('http.request', { line: line.trim() }) },
  })
);

app.use(express.json({ limit: '20kb' }));

// Baseline rate limit for all API traffic; auth endpoints add a stricter limit.
app.use('/api', apiLimiter);

const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

app.get('/health', (req, res) => {
  const readyState = mongoose.connection.readyState;
  const connected = readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'ok' : 'unavailable',
    database: DB_STATES[readyState] || 'unknown',
    uptime_seconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

app.use('/api/v1/user', require('./routes/users'));
app.use('/api/v1/emp', require('./routes/employees'));

app.use((req, res) => {
  logger.warn('request.route_not_found', { ip: req.ip, method: req.method, path: req.originalUrl });
  res.status(404).json({ error: { code: 'ROUTE_NOT_FOUND', message: 'Route not found' } });
});

app.use(require('./middleware/errors'));

module.exports = app;
