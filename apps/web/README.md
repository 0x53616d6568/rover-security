# ENISOLAR operator console (`apps/web`)

Responsive browser console for the Phase 1 rover. Runs on a phone or a PC and
uses two independent MQTT links: the telemetry broker is read-only and the
command broker is publish-only. BLE remains available as an alternate local
control path for bring-up and bench testing.

The console is a control surface, not a second safety controller. The ESP32
owns authorization, command validation, motor output, timeouts, and stopping on
disconnect or fault. The physical motor cut-off is always independent.

## Layout

```text
src/
  app/          Rover hook + reducer (connection, safety, axes, events)
  ble/          Web Bluetooth, MQTT, and demo adapters
  protocol/     Bounded command encoding and telemetry parsing
  features/
    auth/       Operator sign-in
    welcome/    Readiness overview
    rovers/     Fleet/owner bindings + API client
    connection/ Link status, demo toggle, WiFi init
    control/    Classic control view and 3D cockpit iframe bridge
    telemetry/  Sensor cards and event log
    camera/     Auxiliary payload status
    help/       Shortcuts and safety reference
  shared/
    ui/         Button, Panel, StatusPill, Field, Metric, PageHeader
    lib/        Class helper, telemetry reading helpers
  styles/       Design tokens + base stylesheet
public/
  cockpit.html  Self-contained 3D HUD (import map loads three.js from CDN)
  rover.svg, manifest.webmanifest, sw.js
```

## Design system

Warm graphite surfaces (`#070a09` / `#0e1412`), solar-amber accent
(`#E9B44C`), live-green reserved for healthy links (`#5FD3A0`), and IBM Plex
Sans/Mono. Layout is a dense instrument panel: desktop uses a persistent
sidebar; phones use a five-item bottom navigation with Camera/Help in the
header overflow. Status chips always show command MQTT state, safety state,
and telemetry age.

Telemetry values are rendered exactly as received. Missing, invalid, stale,
and simulated readings are labelled and never replaced with a plausible
number. Motion requires the command link plus an explicit arm; STOP is always
available and there is no auto-resume.

## Development

From the repository root:

```powershell
npm install
npm run dev        # Vite; HTTPS on localhost via basic-ssl plugin
npm run lint
npm run test:web
npm run build
```

The Vite dev server proxies `/api` to `127.0.0.1:8080`. When the API or
PostgreSQL is unavailable, the console uses a browser-local fallback store
(`rover-users-fallback`). The seeded offline owner is `Owner` / `Rover2026!`;
it never leaves the browser. For real authorization, start `apps/api` with a
database and an encryption key.

Copy `.env.example` to `.env.local` and fill the broker URLs/credentials.
`.env.local` is gitignored. Never commit broker credentials.

## Testing on hardware

First target Chromium-based browsers with Web Bluetooth support. BLE access
requires a secure context (`https://` or localhost), a user gesture, and device
permission. Verify unsupported-browser messaging, connect/disconnect, STOP on
page hide, invalid frames, and disabled controls before powered movement.

See [`../../docs/dashboard.md`](../../docs/dashboard.md) and
[`../../docs/mqtt-architecture.md`](../../docs/mqtt-architecture.md).
