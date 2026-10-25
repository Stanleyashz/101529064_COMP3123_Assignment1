process.env.MONGODB_URI = '';

const request = require('supertest');
const handler = require('../api/index');

test('the Vercel handler returns a JSON 503 when the database is not configured', async () => {
  const res = await request(handler).get('/health');
  expect(res.status).toBe(503);
  expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE');
});
