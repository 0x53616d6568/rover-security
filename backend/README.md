# Rover backend — Express + PostgreSQL

Node/Express backend for rover product access and user management. Uses PostgreSQL through `pg`.

If PostgreSQL is unreachable, the backend still starts. Product-management calls return database errors and the phone app falls back to browser `localStorage` (`rover-users-fallback`).

```text
backend/
├── server.mjs
└── package.json
```

## Prerequisites

- PostgreSQL 14+
- Node.js 22+ (or current LTS)
- `psql`/`pg_isready` if you want to check the database connection

## Install and start

From the repository root:

```powershell
npm --prefix backend install
npm --prefix backend run start
```

Environment variables:

```text
DATABASE_URL=postgres://<user>:<password>@127.0.0.1:5432/rover_users
ROVER_BACKEND_ENCRYPTION_KEY=<at-least-32-byte-secret>
ROVER_BACKEND_PORT=8080        # optional
ROVER_BACKEND_HOST=127.0.0.1  # optional
```

Create a local test database first:

```powershell
psql -U postgres -c "CREATE DATABASE rover_users;"
```

Do not commit `ROVER_BACKEND_ENCRYPTION_KEY`. Store it in `backend/.env.local` or your secret manager.

## Database schema

The server creates these tables automatically:

- `users(id, name UNIQUE, active_rover_id, password_hash, created_at)`
- `rover_bindings(rover_id PK, user_id FK, mac_cipher, connection_count, created_at, updated_at)`

MAC addresses are encrypted with AES-256-GCM using `ROVER_BACKEND_ENCRYPTION_KEY`. The table stores the hash/mask in `rover_id` and encrypted MAC in `mac_cipher`; it does not store plaintext MACs.

Passwords use Node `crypto.scrypt` with a random per-user salt. Provide `password` when calling `POST /api/users`; users without a password cannot log in.

## Authentication

Express sets an `HttpOnly` cookie named `rover-auth` after a successful login. User/rover management and rover connect/disconnect endpoints require this cookie.

- `POST /api/auth/login` — `{ "name": "Ada", "password": "..." }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## API

- `GET /api/users`
- `POST /api/users` — `{ "name": "Ada", "password": "..." }`
- `GET /api/users/:id/rovers`
- `POST /api/users/:id/rovers` — `{ "mac": "AA:BB:CC:DD:EE:FF" }`
- `DELETE /api/users/:id/rovers/:rover_id`
- `GET /api/rover/:rover_id` — returns owner/binding without decrypting the MAC.
- `POST /api/rover/connect` — `{ "roverId", "userId"? }`
- `POST /api/rover/disconnect` — `{ "roverId" }`
- `GET /api/debug` — counts only.

The phone app uses these through the Vite proxy (`/api/*`) or `VITE_API_BASE`.

## Smoke test

```powershell
npm --prefix backend run start
curl http://127.0.0.1:8080/api/users
```
