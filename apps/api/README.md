# Rover management API (`apps/api`)

Express + PostgreSQL service for owner accounts, signed sessions, rover
bindings, and connect/disconnect state. MAC addresses are encrypted at rest
with AES-256-GCM; lookups use a SHA-256 prefix and reads return a masked MAC.

## Layout

```text
src/
  config.mjs          Environment parsing and defaults
  app.mjs             Express wiring and middleware order
  index.mjs           Boot, migration retry, graceful shutdown
  db/                 Connection pool and idempotent migrations
  lib/                Crypto and HTTP helpers
  middleware/         Auth, error mapping, security headers
  repositories/       users.mjs, rovers.mjs
  services/           Sessions, serializers, login guard
  routes/             auth, users, rovers, health
test/
  crypto.test.mjs     Node test-runner unit tests
```

## Contract

- `POST /api/auth/login` sets an `HttpOnly`, `SameSite=Lax` session cookie.
- `GET /api/auth/me` returns the signed-in owner; `POST /api/auth/logout` clears it.
- `GET /api/users` lists owners; `POST /api/users` creates one.
- `GET|POST /api/users/:id/rovers` lists or binds rovers. Binding is restricted
  to the signed-in owner (`403` otherwise); duplicate owner names return `409`.
- `DELETE /api/users/:id/rovers/:roverId` removes your own binding.
- `POST /api/rover/connect|disconnect` requires ownership of the binding.
- `GET /api/health` is `503` while PostgreSQL is unavailable.

Sessions are `v1.<userId>.<expiresAt>.<HMAC-SHA256>` and expire by default
after 24 h. Passwords use per-user scrypt salts. Login is rate-limited in
process; a multi-instance deployment should replace that with a shared store.

## Run

From the repository root:

```powershell
npm install
npm run dev:api
npm run test:api
```

Environment variables:

```text
DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/rover_users
ROVER_BACKEND_ENCRYPTION_KEY=<at-least-16-character-secret>
ROVER_BACKEND_PORT=8080
ROVER_BACKEND_HOST=127.0.0.1
ROVER_COOKIE_SECURE=1          # required in production
ROVER_SESSION_TTL_MS=86400000
ROVER_CORS_ORIGIN=https://console.example
ROVER_LOGIN_MAX_ATTEMPTS=10
```

Missing `DATABASE_URL` uses a local development default. Missing encryption
key is allowed only in development and logs a warning; production fails fast.
The API starts even when PostgreSQL is down and retries migrations every 15 s.

See [`../../docs/dashboard.md`](../../docs/dashboard.md) and
[`../../SECURITY.md`](../../SECURITY.md).
