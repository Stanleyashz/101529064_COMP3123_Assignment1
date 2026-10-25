process.env.JWT_SECRET = 'unit-test-secret';
process.env.AUTH_RATE_LIMIT_MAX = '1000';
process.env.API_RATE_LIMIT_MAX = '5000';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

let db;
let app;
let aliceToken;
let bobToken;
let aliceId;
let employeeId;

const account = (username) => ({
  username,
  email: `${username}@example.com`,
  password: 'StrongPass123',
});

const employee = {
  first_name: 'Sam',
  last_name: 'Lee',
  email: 'sam@example.com',
  position: 'Developer',
  salary: 50000,
  date_of_joining: '2025-01-01',
  department: 'IT',
};

beforeAll(async () => {
  db = await MongoMemoryServer.create();
  await mongoose.connect(db.getUri());
  app = require('../src/app');
  await mongoose.model('User').init();
  await mongoose.model('Employee').init();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (db) await db.stop();
});

describe('service health', () => {
  test('GET /health reports the API and database are up, with Helmet headers', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(typeof res.body.uptime_seconds).toBe('number');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeTruthy();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  test('unknown routes return a JSON 404 instead of HTML', async () => {
    const res = await request(app).get('/api/v1/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
  });
});

describe('signup', () => {
  test('rejects a missing body with field-level details', async () => {
    const res = await request(app).post('/api/v1/user/signup').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((item) => item.field)).toEqual(
      expect.arrayContaining(['username', 'email', 'password'])
    );
  });

  test('rejects invalid email, short password, weak password, long username and extra fields', async () => {
    const cases = [
      { ...account('alice'), email: 'not-an-email' },
      { ...account('alice'), password: 'short1' },
      { ...account('alice'), password: 'onlyletters' },
      { ...account('a'.repeat(41)) },
      { ...account('alice'), isAdmin: true },
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/v1/user/signup').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.details.length).toBeGreaterThan(0);
    }
  });

  test('rejects malformed JSON with 400 INVALID_JSON', async () => {
    const res = await request(app)
      .post('/api/v1/user/signup')
      .set('Content-Type', 'application/json')
      .send('{"username":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  test('rejects oversized bodies with 413', async () => {
    const res = await request(app)
      .post('/api/v1/user/signup')
      .send({ ...account('alice'), bio: 'x'.repeat(25000) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  test('creates an account, hashes the password, and never returns it', async () => {
    const res = await request(app).post('/api/v1/user/signup').send(account('alice'));
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('alice');
    expect(res.body.user.password).toBeUndefined();
    aliceId = res.body.user.id;

    const stored = await mongoose.connection.collection('users').findOne({ username: 'alice' });
    expect(stored.password).not.toBe('StrongPass123');
    expect(stored.password.startsWith('$2')).toBe(true);
    expect(await bcrypt.compare('StrongPass123', stored.password)).toBe(true);
  });

  test('rejects a duplicate username and a duplicate email with 409', async () => {
    const duplicateUsername = await request(app).post('/api/v1/user/signup').send(account('alice'));
    expect(duplicateUsername.status).toBe(409);
    expect(duplicateUsername.body.error.code).toBe('DUPLICATE_ACCOUNT');

    const duplicateEmail = await request(app).post('/api/v1/user/signup').send({
      username: 'alice2',
      email: 'alice@example.com',
      password: 'StrongPass123',
    });
    expect(duplicateEmail.status).toBe(409);
    expect(duplicateEmail.body.error.details[0].field).toBe('email');

    expect((await request(app).post('/api/v1/user/signup').send(account('bob'))).status).toBe(201);
  });
});

describe('login', () => {
  test('rejects missing credentials and invalid credentials', async () => {
    expect((await request(app).post('/api/v1/user/login').send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/user/login').send({ username: 'alice' })).status).toBe(400);
    const res = await request(app).post('/api/v1/user/login').send({ username: 'alice', password: 'WrongPass123' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('logs in by username and by email, returning a JWT', async () => {
    const byUsername = await request(app)
      .post('/api/v1/user/login')
      .send({ username: 'alice', password: 'StrongPass123' });
    expect(byUsername.status).toBe(200);
    expect(byUsername.body.token).toBeTruthy();
    expect(byUsername.body.user.password).toBeUndefined();
    aliceToken = byUsername.body.token;

    const byEmail = await request(app)
      .post('/api/v1/user/login')
      .send({ email: 'alice@example.com', password: 'StrongPass123' });
    expect(byEmail.status).toBe(200);
    expect(byEmail.body.token).toBeTruthy();

    const bob = await request(app).post('/api/v1/user/login').send({ username: 'bob', password: 'StrongPass123' });
    expect(bob.status).toBe(200);
    bobToken = bob.body.token;
  });
});

describe('JWT authentication', () => {
  test('rejects missing, invalid, tampered, and expired tokens', async () => {
    expect((await request(app).get('/api/v1/emp/employees')).status).toBe(401);

    const invalid = await request(app).get('/api/v1/emp/employees').set({ Authorization: 'Bearer invalid-token' });
    expect(invalid.status).toBe(401);
    expect(invalid.body.error.code).toBe('INVALID_TOKEN');

    const tampered = await request(app)
      .get('/api/v1/emp/employees')
      .set({ Authorization: `Bearer ${aliceToken.slice(0, -2)}xx` });
    expect(tampered.status).toBe(401);
    expect(tampered.body.error.code).toBe('INVALID_TOKEN');

    const expired = jwt.sign({}, process.env.JWT_SECRET, { subject: aliceId, expiresIn: '-1s' });
    const expiredRes = await request(app).get('/api/v1/emp/employees').set({ Authorization: `Bearer ${expired}` });
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error.code).toBe('TOKEN_EXPIRED');

    const wrongSecret = jwt.sign({}, 'some-other-secret', { subject: aliceId });
    expect(
      (await request(app).get('/api/v1/emp/employees').set({ Authorization: `Bearer ${wrongSecret}` })).status
    ).toBe(401);
  });

  test('rejects a valid token whose user no longer exists', async () => {
    const user = await request(app).post('/api/v1/user/signup').send(account('deleted'));
    const login = await request(app)
      .post('/api/v1/user/login')
      .send({ username: 'deleted', password: 'StrongPass123' });
    const { ObjectId } = mongoose.Types;
    await mongoose.connection.collection('users').deleteOne({ _id: new ObjectId(user.body.user.id) });

    const res = await request(app).get('/api/v1/emp/employees').set({ Authorization: `Bearer ${login.body.token}` });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

describe('employee validation', () => {
  const alice = () => ({ Authorization: `Bearer ${aliceToken}` });

  test('requires every field', async () => {
    const res = await request(app).post('/api/v1/emp/employees').set(alice()).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toHaveLength(7);
  });

  test('rejects bad email, salary, date, long text, and unexpected fields', async () => {
    const cases = [
      { ...employee, email: 'bad-email' },
      { ...employee, salary: '50000' },
      { ...employee, salary: -1 },
      { ...employee, date_of_joining: 'not-a-date' },
      { ...employee, first_name: 'x'.repeat(51) },
      { ...employee, user: aliceId },
      { ...employee, position: '' },
    ];
    for (const body of cases) {
      const res = await request(app).post('/api/v1/emp/employees').set(alice()).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('rejects an invalid employee id with 400', async () => {
    const res = await request(app).get('/api/v1/emp/employees/not-an-id').set(alice());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ID');
    expect((await request(app).put('/api/v1/emp/employees/not-an-id').set(alice()).send({ position: 'CTO' })).status).toBe(400);
    expect((await request(app).delete('/api/v1/emp/employees?eid=not-an-id').set(alice())).status).toBe(400);
    expect((await request(app).delete('/api/v1/emp/employees').set(alice())).status).toBe(400);
  });
});

describe('employee CRUD and ownership', () => {
  const alice = () => ({ Authorization: `Bearer ${aliceToken}` });
  const bob = () => ({ Authorization: `Bearer ${bobToken}` });

  test('creates an employee owned by the authenticated user', async () => {
    const res = await request(app).post('/api/v1/emp/employees').set(alice()).send(employee);
    expect(res.status).toBe(201);
    employeeId = res.body.employee._id;
    expect(res.body.employee.user).toBe(aliceId);
  });

  test("lists only the owner's employees", async () => {
    const mine = await request(app).get('/api/v1/emp/employees').set(alice());
    expect(mine.status).toBe(200);
    expect(mine.body.count).toBe(1);
    expect(mine.body.employees).toHaveLength(1);

    const theirs = await request(app).get('/api/v1/emp/employees').set(bob());
    expect(theirs.status).toBe(200);
    expect(theirs.body.employees).toHaveLength(0);
  });

  test('reads, updates, and rejects an unknown employee', async () => {
    expect((await request(app).get(`/api/v1/emp/employees/${employeeId}`).set(alice())).status).toBe(200);

    const updated = await request(app)
      .put(`/api/v1/emp/employees/${employeeId}`)
      .set(alice())
      .send({ position: 'Senior Developer', salary: 95000 });
    expect(updated.status).toBe(200);
    expect(updated.body.employee.position).toBe('Senior Developer');

    const emptyUpdate = await request(app).put(`/api/v1/emp/employees/${employeeId}`).set(alice()).send({});
    expect(emptyUpdate.status).toBe(400);

    const missing = await request(app).get('/api/v1/emp/employees/507f1f77bcf86cd799439011').set(alice());
    expect(missing.status).toBe(404);
    expect(missing.body.error.code).toBe('NOT_FOUND');
  });

  test('rejects cross-user read, update, and delete with 403', async () => {
    const read = await request(app).get(`/api/v1/emp/employees/${employeeId}`).set(bob());
    expect(read.status).toBe(403);
    expect(read.body.error.code).toBe('FORBIDDEN');

    const update = await request(app).put(`/api/v1/emp/employees/${employeeId}`).set(bob()).send({ position: 'CEO' });
    expect(update.status).toBe(403);

    const remove = await request(app).delete(`/api/v1/emp/employees?eid=${employeeId}`).set(bob());
    expect(remove.status).toBe(403);

    const stillThere = await request(app).get(`/api/v1/emp/employees/${employeeId}`).set(alice());
    expect(stillThere.status).toBe(200);
    expect(stillThere.body.employee.position).toBe('Senior Developer');
  });

  test('owner deletes the employee and a second delete returns 404', async () => {
    const res = await request(app).delete(`/api/v1/emp/employees?eid=${employeeId}`).set(alice());
    expect(res.status).toBe(204);
    expect(res.text).toBe('');

    const again = await request(app).delete(`/api/v1/emp/employees?eid=${employeeId}`).set(alice());
    expect(again.status).toBe(404);
  });
});
