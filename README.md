# COMP 3123 Assignment 1 — Employee API

A secure REST API built with Node.js, Express, and MongoDB. Users register, log in, and receive a JWT. Every employee record belongs to the user who created it, and all employee queries are scoped to that owner.

| Item | Value |
|---|---|
| Student name | Stanley Okafor |
| Student number | 101529064 |
| Repository | [101529064_COMP3123_Assignment1](https://github.com/Stanleyashz/101529064_COMP3123_Assignment1) |
| Deployed API | https://101529064-comp-3123-assignment1.vercel.app/ |
| Database | `comp3123_assignment1` |

## Purpose

The API demonstrates authentication, authorization, a user–employee database relationship, input validation, password hashing, security headers, rate limiting, logging, error handling, and a health check.

## Technologies

- Node.js 20+ and Express 4 (REST API, Express Router)
- MongoDB with Mongoose 8
- JSON Web Tokens (`jsonwebtoken`) for authentication
- `bcryptjs` for password hashing
- `helmet` for HTTP security headers
- `express-rate-limit` for rate limiting
- `morgan` plus a structured JSON-line logger for application logs
- Jest, Supertest, and `mongodb-memory-server` for automated tests
- Vercel serverless function for hosting

## Project structure

```
api/index.js              Vercel serverless entry point (connects to MongoDB)
server.js                 Local HTTP server
src/app.js                Express app: security, logging, routing, health, errors
src/config.js             Environment configuration
src/routes/               Express Routers (users, employees)
src/controllers/          Request handling and response codes
src/services/             Database operations, including ownership-scoped queries
src/models/               Mongoose User and Employee schemas
src/middleware/           Authentication, rate limiting, central error handling
src/lib/                  Validation rules and the file logger
test/                     Jest endpoint, rate-limit, and logger tests
postman/                  Postman collection
docs/                     Sample log output from a real local run
```

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/Stanleyashz/101529064_COMP3123_Assignment1.git
cd 101529064_COMP3123_Assignment1
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set `MONGODB_URI` and a long random `JWT_SECRET`. Never commit `.env`.

### 3. Start MongoDB

Local MongoDB must be running and the database name must be `comp3123_assignment1`:

```bash
mongod --dbpath <your-data-directory>
# or, with Docker:
docker run -d -p 27017:27017 --name comp3123-mongo mongo:7
```

The default local URI is `mongodb://127.0.0.1:27017/comp3123_assignment1`.

### 4. Start the API

```bash
npm run dev     # nodemon
npm start       # plain node
```

The API listens on `http://localhost:3000` by default. Startup and every request are written to `logs/app.log`.

### 5. Run the tests

```bash
npm test
```

The suite starts an in-memory MongoDB with `mongodb-memory-server`, so no local database is needed. The first run downloads a MongoDB binary, which requires internet access.

## Configuration

| Variable | Required | Default | Purpose |
|---|---:|---|---|
| `PORT` | No | `3000` | Local HTTP port |
| `MONGODB_URI` | Yes | — | MongoDB connection string, including the `comp3123_assignment1` database name |
| `JWT_SECRET` | Yes | — | Secret used to sign and verify JWTs |
| `JWT_EXPIRES_IN` | No | `1h` | Token lifetime |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` (15 min) | Rate-limit window |
| `AUTH_RATE_LIMIT_MAX` | No | `20` | Auth requests allowed per window per IP |
| `API_RATE_LIMIT_MAX` | No | `300` | General API requests allowed per window per IP |
| `LOG_DIR` | No | `logs` | Directory for local log files |
| `LOG_FILE` | No | `logs/app.log` | Log file path |
| `LOG_TO_FILE` | No | `true` locally | Set to `false` to disable file output |
| `LOG_TO_CONSOLE` | No | `true` | Set to `false` to disable console output |

`.env.example` contains safe placeholder values only.

## API reference

Base URL: `{{baseUrl}}/api/v1` (local `http://localhost:3000`).

Protected endpoints require this header:

```
Authorization: Bearer <jwt>
```

| # | Method | Endpoint | Auth | Success |
|---|---|---|---:|---:|
| 1 | `POST` | `/api/v1/user/signup` | No | `201` |
| 2 | `POST` | `/api/v1/user/login` | No | `200` |
| 3 | `GET` | `/api/v1/emp/employees` | Yes | `200` |
| 4 | `POST` | `/api/v1/emp/employees` | Yes | `201` |
| 5 | `GET` | `/api/v1/emp/employees/{eid}` | Yes | `200` |
| 6 | `PUT` | `/api/v1/emp/employees/{eid}` | Yes | `200` |
| 7 | `DELETE` | `/api/v1/emp/employees?eid={eid}` | Yes | `204` |

### Signup

`POST /api/v1/user/signup`

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "StrongPass123"
}
```

Rules: username 3–40 characters (letters, numbers, `.`, `_`, `-`), valid unique email, password 8–72 characters with at least one letter and one number. Extra fields are rejected.

`201 Created`

```json
{
  "message": "Account created",
  "user": {
    "id": "68f1c0c2e4b0a1b2c3d4e5f6",
    "username": "alice",
    "email": "alice@example.com",
    "created_at": "2026-10-19T06:00:00.000Z"
  }
}
```

The hashed password is never returned.

### Login

`POST /api/v1/user/login`

Username or email may be used:

```json
{ "username": "alice", "password": "StrongPass123" }
```

```json
{ "email": "alice@example.com", "password": "StrongPass123" }
```

`200 OK`

```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": "1h",
  "user": { "id": "68f1c0c2e4b0a1b2c3d4e5f6", "username": "alice", "email": "alice@example.com" }
}
```

### Create employee

`POST /api/v1/emp/employees` with `Authorization: Bearer <token>`

```json
{
  "first_name": "Sam",
  "last_name": "Lee",
  "email": "sam@example.com",
  "position": "Engineer",
  "salary": 85000,
  "date_of_joining": "2025-01-15",
  "department": "Engineering"
}
```

All seven fields are required. `salary` must be a nonnegative number (maximum 1,000,000,000). `date_of_joining` must be a valid date between 1900 and one year in the future. Text limits: names 50, position/department 100, email 254 characters. The owner is taken from the JWT and cannot be supplied by the client.

`201 Created`

```json
{
  "message": "Employee created",
  "employee": {
    "_id": "68f1c100e4b0a1b2c3d4e601",
    "first_name": "Sam",
    "last_name": "Lee",
    "email": "sam@example.com",
    "position": "Engineer",
    "salary": 85000,
    "date_of_joining": "2025-01-15T00:00:00.000Z",
    "department": "Engineering",
    "user": "68f1c0c2e4b0a1b2c3d4e5f6",
    "created_at": "2026-10-19T06:05:00.000Z",
    "updated_at": "2026-10-19T06:05:00.000Z"
  }
}
```

### List, read, update, delete

```http
GET /api/v1/emp/employees
```

```json
{ "count": 1, "employees": [ { "_id": "68f1c100e4b0a1b2c3d4e601", "first_name": "Sam" } ] }
```

`GET /api/v1/emp/employees/{eid}` returns `{ "employee": { ... } }`.

`PUT /api/v1/emp/employees/{eid}` accepts any non-empty subset of the seven fields:

```json
{ "position": "Senior Engineer", "salary": 95000 }
```

`DELETE /api/v1/emp/employees?eid={eid}` returns `204 No Content` with an empty body.

### Error responses

Every error has the same shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request data is invalid",
    "details": [{ "field": "email", "message": "Email must be a valid address" }]
  }
}
```

| Status | Code | When |
|---:|---|---|
| `400` | `VALIDATION_ERROR` | Missing, invalid, or unexpected fields; empty update |
| `400` | `INVALID_ID` | `eid` is not a 24-character MongoDB ObjectId |
| `400` | `INVALID_JSON` | Malformed JSON body |
| `401` | `AUTH_REQUIRED` | No `Bearer` token |
| `401` | `INVALID_TOKEN` | Bad signature, tampered token, or user no longer exists |
| `401` | `TOKEN_EXPIRED` | Expired JWT |
| `401` | `INVALID_CREDENTIALS` | Wrong username/email or password |
| `403` | `FORBIDDEN` | Employee exists but belongs to another user |
| `404` | `NOT_FOUND` | No employee with that ID |
| `404` | `ROUTE_NOT_FOUND` | Unsupported route |
| `409` | `DUPLICATE_ACCOUNT` | Username or email already registered |
| `413` | `PAYLOAD_TOO_LARGE` | Body above 20 kb |
| `415` | `UNSUPPORTED_MEDIA_TYPE` | Unsupported body encoding |
| `429` | `RATE_LIMITED` | Rate limit exceeded |
| `500` | `INTERNAL_ERROR` | Unexpected server error |
| `503` | `DATABASE_UNAVAILABLE` | Serverless handler cannot reach MongoDB |

## Authentication

1. `POST /api/v1/user/signup` creates the account with a bcrypt hash (cost 12).
2. `POST /api/v1/user/login` verifies the password and signs a JWT with `sub` set to the user's ID.
3. The client sends `Authorization: Bearer <token>` on employee requests.
4. `src/middleware/auth.js` verifies the signature and expiry, then loads the user so a token for a deleted account is rejected.
5. Missing tokens get `401 AUTH_REQUIRED`; invalid ones `401 INVALID_TOKEN`; expired ones `401 TOKEN_EXPIRED`.

The employee owner is always `req.userId` from the verified token. A `user` field in the request body is rejected as an unexpected field, and an `eid` in the URL or query string only selects the record — it never changes ownership.

## Authorization and ownership

Each employee stores `user: ObjectId` referencing the creating user. Every query is scoped in MongoDB:

- List: `Employee.find({ user: req.userId })`
- Create: `user: req.userId`
- Read/update/delete: the record is loaded, then `employee.user` is compared with `req.userId`.

If the ID does not exist the API returns `404`. If it exists but belongs to someone else it returns `403 FORBIDDEN`, so the two cases are distinguishable as the assignment requires. Cross-user reads, updates, and deletes are all rejected, and the owner's record is left unchanged.

To demonstrate this, run the Postman folder **04 - Two-user ownership**: user B gets `403` on each of user A's employee requests, while user A can still read the untouched record.

## Security

### Password hashing

Passwords are hashed with bcrypt (12 rounds) before insertion and the field uses `select: false`, so it is only loaded explicitly during login. No response includes a password.

### Helmet

Helmet sets headers such as `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options`, and `Referrer-Policy`, and `X-Powered-By` is disabled. These reduce exposure to MIME sniffing, clickjacking, and some cross-site scripting.

### Rate limiting

Rate limiting caps how many requests one client IP can make in a time window. It slows down password guessing, credential stuffing, and signup spam.

- Authentication endpoints (`/api/v1/user/signup` and `/api/v1/user/login`): **20 requests per 15 minutes per IP**.
- All other API routes: **300 requests per 15 minutes per IP**.

When a limit is exceeded the API returns `429 Too Many Requests` with the standard `RateLimit` and `Retry-After` headers and:

```json
{ "error": { "code": "RATE_LIMITED", "message": "Too many requests. Please wait and try again.", "retry_after_seconds": 900 } }
```

`app.set('trust proxy', 1)` is required on Vercel so the limiter uses the real client IP from the proxy header. Limits are held in memory, so on a serverless platform each warm instance counts separately.

To see the 429, run the Postman folder **05 - Rate limit** with about 25 iterations; the first 20 attempts return `401` and the rest return `429`.

### Input validation

`src/lib/validation.js` validates required fields, string lengths, username characters, email format, password strength, salary type/range, date validity, MongoDB ObjectIds, and unexpected fields. Validation never trusts client input and returns field-level `details`. Bodies over 20 kb return `413`; malformed JSON returns `400`.

### Environment variables and secrets

`.env` is gitignored and `.env.example` contains placeholders only. JWT secrets and database credentials are never written to logs or returned to clients.

## Logging

Logs are JSON lines in **`logs/app.log`** during local and normal server runs. Each record has `time`, `level`, `event`, and contextual fields. On Vercel (`VERCEL` is set) file writing is skipped because the filesystem is read-only, and the same records go to the platform's stdout/stderr logs.

Events include:

- `server.started`, `server.listening`, `server.stopping`
- `http.request` for method, path, status, size, and response time
- `auth.signup_success`, `auth.signup_duplicate`, `auth.login_success`, `auth.login_failed`
- `auth.missing_token`, `auth.invalid_token`, `auth.expired_token`, `auth.user_missing`
- `validation.*`, `request.invalid_json`, `request.invalid_employee_id`, `request.route_not_found`
- `authz.employee_forbidden`, `security.rate_limit_exceeded`, `employee.created/updated/deleted`
- `app.unexpected_error`, `database.connection_failed`

Sensitive values are intentionally excluded: passwords are never logged, and keys such as `password`, `token`, `authorization`, `secret`, and `cookie` are replaced with `[REDACTED]` before serialisation. Request bodies are not logged. A real example is in `docs/sample-app.log`, and `logs/` is gitignored because it is generated at runtime.

## Health check

`GET /health` (no authentication):

```json
{
  "status": "ok",
  "database": "connected",
  "uptime_seconds": 42,
  "timestamp": "2026-10-19T06:10:00.000Z"
}
```

Returns `200` when MongoDB is connected and `503` with `"status": "unavailable"` when it is not.

## Postman collection

Import `postman/COMP3123-Assignment1.postman_collection.json`.

1. Set the `baseUrl` collection variable to your local or deployed API URL.
2. Run **00 - Start test run** first. It sets a unique `runId` so signup data does not collide on repeated runs.
3. Run the folders in order. Login requests store `token` and `secondToken`; create requests store `eidA` and `eidB`.
4. Run **05 - Rate limit** separately with about 25 iterations and capture the `429` response.

The collection covers signup (valid, duplicate username, duplicate email, invalid email, weak password, missing fields), login (username, email, invalid credentials, missing credentials), employee CRUD, all validation errors, missing/invalid/tampered JWTs, unknown routes, cross-user `403` cases, and rate limiting. Because auth allows 20 requests per 15 minutes, wait for the window to reset (or restart a local server, which clears the in-memory limiter) before running the whole collection again.

## Testing

```bash
npm test
```

Four suites (24 tests) run:

- `test/api.test.js` — health and Helmet headers, unknown route, malformed/oversized bodies, signup validation and duplicates, password hashing, login by username/email, missing/invalid/tampered/expired tokens, deleted-user tokens, employee validation, CRUD, invalid IDs, ownership `403`s, and status codes.
- `test/rate-limit.test.js` — sixth auth request returns `429` with `Retry-After`.
- `test/logger.test.js` — log file output and redaction of passwords and tokens.
- `test/vercel-handler.test.js` — the serverless handler returns a JSON `503` when the database is not configured.

## Deployment on Vercel

1. Push the repository to GitHub.
2. In MongoDB Atlas, create the `comp3123_assignment1` database, create a database user, and allow access from `0.0.0.0/0` (or your host's ranges) under Network Access.
3. In Vercel, import the repository. `api/index.js` is detected as the serverless function; `vercel.json` rewrites all paths to it.
4. Add `MONGODB_URI` (for example `mongodb+srv://user:pass@cluster.mongodb.net/comp3123_assignment1`) and `JWT_SECRET` under Project Settings → Environment Variables. Do not commit them.
5. Deploy and open `https://<your-project>.vercel.app/health`. It should return `200` with `"database": "connected"`.
6. Set the Postman `baseUrl` to the deployed URL and run the collection.

The handler caches the Mongo connection across warm invocations and clears a failed attempt so the next request retries instead of failing permanently.
