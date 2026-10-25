const fs = require('fs');
const os = require('os');
const path = require('path');

const logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'comp3123-logs-'));
process.env.LOG_DIR = logDir;
process.env.LOG_FILE = path.join(logDir, 'app.log');
process.env.LOG_TO_FILE = 'true';
process.env.LOG_TO_CONSOLE = 'false';

const logger = require('../src/lib/logger');

afterAll(() => {
  fs.rmSync(logDir, { recursive: true, force: true });
});

test('writes JSON lines to the log file and redacts sensitive fields', () => {
  logger.info('auth.login_success', {
    userId: 'abc123',
    password: 'SuperSecret123',
    nested: { authorization: 'Bearer abc.def.ghi', token: 'jwt-value' },
  });

  const lines = fs.readFileSync(path.join(logDir, 'app.log'), 'utf8').trim().split('\n');
  expect(lines).toHaveLength(1);

  const record = JSON.parse(lines[0]);
  expect(record.event).toBe('auth.login_success');
  expect(record.level).toBe('info');
  expect(record.userId).toBe('abc123');
  expect(record.password).toBe('[REDACTED]');
  expect(record.nested.authorization).toBe('[REDACTED]');
  expect(record.nested.token).toBe('[REDACTED]');

  const raw = fs.readFileSync(path.join(logDir, 'app.log'), 'utf8');
  expect(raw).not.toContain('SuperSecret123');
  expect(raw).not.toContain('jwt-value');
  expect(raw).not.toContain('abc.def.ghi');
});

test('records request metadata without a body', () => {
  logger.warn('auth.login_failed', { ip: '127.0.0.1', identifier: 'username' });
  const lines = fs.readFileSync(path.join(logDir, 'app.log'), 'utf8').trim().split('\n');
  const record = JSON.parse(lines[lines.length - 1]);
  expect(record.event).toBe('auth.login_failed');
  expect(record.password).toBeUndefined();
});
