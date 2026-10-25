process.env.JWT_SECRET = 'rate-limit-test-secret';
process.env.AUTH_RATE_LIMIT_MAX = '5';
process.env.API_RATE_LIMIT_MAX = '1000';
process.env.RATE_LIMIT_WINDOW_MS = '900000';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');

let db;
let app;

beforeAll(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  app = require('../src/app');
});

afterAll(async () => {
  await mongoose.disconnect();
  await db.stop();
});

test('the sixth authentication request in the window returns 429', async () => {
  const attempt = () =>
    request(app).post('/api/v1/user/login').send({ username: 'nobody', password: 'WrongPass123' });

  for (let i = 0; i < 5; i += 1) {
    expect((await attempt()).status).toBe(401);
  }

  const limited = await attempt();
  expect(limited.status).toBe(429);
  expect(limited.body.error.code).toBe('RATE_LIMITED');
  expect(limited.headers['retry-after']).toBeTruthy();

  // The general API limiter is separate; a protected route still answers.
  expect((await request(app).get('/health')).status).toBe(200);
});
