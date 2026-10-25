require('dotenv').config();

/**
 * Single place where environment configuration is read.
 * Values are read once at startup so a missing secret fails fast and predictably.
 */
const config = {
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX || 20),
  apiRateLimitMax: Number(process.env.API_RATE_LIMIT_MAX || 300),
  logDir: process.env.LOG_DIR,
  logFile: process.env.LOG_FILE,
  logToFile: process.env.LOG_TO_FILE,
  logToConsole: process.env.LOG_TO_CONSOLE,
};

module.exports = config;
