const fs = require('fs');
const path = require('path');

/**
 * Small structured logger.
 *
 * Local runs append JSON lines to logs/app.log so the marker can inspect how the
 * API behaved. Vercel's filesystem is read-only, so on Vercel (or when the log
 * directory cannot be created) the logger falls back to stdout/stderr.
 *
 * Sensitive keys are redacted before anything is serialised, so passwords,
 * tokens and secrets never reach a log file.
 */
const SENSITIVE_KEY = /^(password|passwordhash|new_password|current_password|token|access_token|refresh_token|authorization|secret|jwt_secret|cookie|set-cookie)$/i;
const MAX_DEPTH = 5;
const isTest = process.env.NODE_ENV === 'test';

const logDir = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
const logFile = process.env.LOG_FILE || path.join(logDir, 'app.log');
const fileEnabled =
  process.env.LOG_TO_FILE === 'true' ||
  (process.env.LOG_TO_FILE !== 'false' && !isTest && !process.env.VERCEL);
const consoleEnabled = process.env.LOG_TO_CONSOLE !== 'false' && (!isTest || Boolean(process.env.LOG_LEVEL));

const state = { fileDisabled: false, dirReady: false };

function redact(value, depth = 0) {
  if (value === null || typeof value !== 'object') return value;
  if (depth >= MAX_DEPTH) return '[TRUNCATED]';
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (value instanceof Error) return { name: value.name, message: value.message };

  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    clean[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(item, depth + 1);
  }
  return clean;
}

function appendToFile(line) {
  if (!fileEnabled || state.fileDisabled) return;
  try {
    if (!state.dirReady) {
      fs.mkdirSync(path.dirname(logFile), { recursive: true });
      state.dirReady = true;
    }
    fs.appendFileSync(logFile, `${line}\n`);
  } catch (error) {
    state.fileDisabled = true;
    if (consoleEnabled) {
      console.error(JSON.stringify({ level: 'error', event: 'logger.file_unavailable', message: error.message }));
    }
  }
}

function write(level, event, meta = {}) {
  if (!fileEnabled && !consoleEnabled) return;
  const record = { ...redact(meta), time: new Date().toISOString(), level, event };
  const line = JSON.stringify(record);
  appendToFile(line);
  if (consoleEnabled) {
    if (level === 'error') console.error(line);
    else console.log(line);
  }
}

module.exports = {
  logFile,
  fileEnabled,
  consoleEnabled,
  redact,
  debug: (event, meta) => write('debug', event, meta),
  info: (event, meta) => write('info', event, meta),
  warn: (event, meta) => write('warn', event, meta),
  error: (event, meta) => write('error', event, meta),
};
