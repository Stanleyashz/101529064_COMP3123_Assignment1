require('dotenv').config();
const mongoose = require('mongoose');
const app = require('../src/app');
const logger = require('../src/lib/logger');
const config = require('../src/config');

let connection;

/**
 * Vercel reuses warm serverless instances. The connect promise is cached so
 * concurrent invocations share one connection, but a failed attempt is cleared
 * so the next request can retry instead of failing forever.
 */
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) return;
  if (!config.mongoUri) throw new Error('MONGODB_URI is not configured');

  if (!connection) {
    connection = mongoose.connect(config.mongoUri).catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  await connection;
}

module.exports = async function handler(req, res) {
  try {
    await connectToDatabase();
  } catch (error) {
    logger.error('database.connection_failed', { message: error.message });
    // Use the raw response API: this runs before the request reaches Express,
    // so Express helpers such as res.status()/res.json() are not available.
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    return res.end(
      JSON.stringify({ error: { code: 'DATABASE_UNAVAILABLE', message: 'Database is temporarily unavailable' } })
    );
  }

  return app(req, res);
};
