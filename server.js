require('dotenv').config();
const mongoose = require('mongoose');
const app = require('./src/app');
const config = require('./src/config');
const logger = require('./src/lib/logger');

async function start() {
  if (!config.mongoUri) throw new Error('MONGODB_URI is required (see .env.example)');
  if (!config.jwtSecret) throw new Error('JWT_SECRET is required (see .env.example)');

  await mongoose.connect(config.mongoUri);
  logger.info('server.started', { port: config.port, database: mongoose.connection.name });

  const server = app.listen(config.port, () => {
    logger.info('server.listening', { url: `http://localhost:${config.port}` });
  });

  const shutdown = async (signal) => {
    logger.info('server.stopping', { signal });
    server.close(async () => {
      await mongoose.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  start().catch((error) => {
    logger.error('server.start_failed', { message: error.message });
    process.exit(1);
  });
}

module.exports = { start };
