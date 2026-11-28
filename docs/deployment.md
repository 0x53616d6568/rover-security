# Deployment: Neon + Render + Vercel

```
Browser ──► Vercel (static React app + /api proxy function)
                 │
                 └──► Render (Express API) ──► Neon PostgreSQL
```

The browser only talks to its own Vercel origin. `api/[...path].js` forwards
`/api/*` to the Render service, so the session cookie stays same-origin and no
CORS or `SameSite=None` configuration is required.

## 1. Neon (PostgreSQL)

1. Create a Neon project and a database named `rover_users`.
2. Copy the **pooled** connection string from the Neon dashboard. It should
   look like:
   `postgres://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/rover_users?sslmode=require`
3. Keep it private. The API applies migrations automatically on boot and
   retries every 15 s if the database is not reachable yet.

## 2. Render (API)

Use the included `render.yaml` blueprint, or create a Web Service manually:

| Setting | Value |
|---|---|
| Build command | `npm ci --omit=dev` |
| Start command | `npm run start:api` |
| Health check | `/api/health` |
| Region | any (match Neon for lower latency) |

Set these environment variables in Render:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `ROVER_BACKEND_HOST` | `0.0.0.0` (Render requires this) |
| `DATABASE_URL` | the Neon pooled URL from step 1 |
| `ROVER_BACKEND_ENCRYPTION_KEY` | generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `ROVER_COOKIE_SECURE` | `1` |
| `ROVER_COOKIE_SAMESITE` | `lax` |
| `ROVER_CORS_ORIGIN` | leave empty when using the Vercel proxy |

`PORT` is injected by Render; the API reads it automatically. The API refuses
to boot in production without `ROVER_BACKEND_ENCRYPTION_KEY`.

> Free Render services sleep after inactivity. The first request after a sleep
> can take several seconds, and `/api/health` will report `503` while Neon is
> still cold. Use a paid instance for an always-on demo.

## 3. Vercel (web + proxy)

1. Import the GitHub repository. Vercel will read `vercel.json`, which already
   sets `npm ci`, `npm run build`, and `apps/web/dist` as the output.
2. Add project environment variables:
   - `ROVER_API_ORIGIN` — the Render service URL, e.g.
     `https://roverx-api.onrender.com` (no trailing slash).
   - All `VITE_*` values from `apps/web/.env.example` that you use, especially
     the two MQTT brokers. These are embedded at **build time**, so redeploy
     after changing them.
3. Deploy. The console is served from the Vercel domain and `/api/*` is handled
   by the proxy function.

If you prefer a direct cross-origin API instead of the proxy, set
`VITE_API_BASE=https://roverx-api.onrender.com`, set
`ROVER_CORS_ORIGIN=https://your-app.vercel.app` on Render, and change Render's
`ROVER_COOKIE_SAMESITE` to `none`. Keep `ROVER_COOKIE_SECURE=1`.

## 4. Verify

1. Open `https://your-app.vercel.app/api/health` — expect
   `{"ok":true,"status":"ok","database":"connected"}`.
2. Sign in with an owner account created through the API or the local console,
   bind a rover MAC, select it, and confirm the command link status.
3. Confirm MQTT telemetry/command links from the browser console. The console
   never invents values: missing or stale readings stay marked unavailable.

## Local development against the cloud API

```powershell
# apps/api/.env  (gitignored)
DATABASE_URL=...
ROVER_BACKEND_ENCRYPTION_KEY=...
NODE_ENV=development
ROVER_BACKEND_HOST=127.0.0.1

# apps/web/.env.local (gitignored)
VITE_API_PROXY_TARGET=http://127.0.0.1:8080
```

Then run `npm run dev:api` and `npm run dev` from the repository root.

## Security notes

- Never commit `.env.local`, database URLs, encryption keys, or broker
  credentials. `.env.example` files contain placeholders only.
- The MQTT credentials are delivered to the browser bundle. Use a dedicated,
  least-privilege broker user: subscribe-only for telemetry, publish-only for
  commands.
- A previously committed broker credential still exists in git history
  (`4c808f6`). Rotate it at the broker before going public.
- The physical emergency stop remains independent of any hosted service.
