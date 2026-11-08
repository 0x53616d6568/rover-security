# ENISOLAR Rover Phone App

## Purpose

This folder is reserved for the Phase 1 operator interface. The app will be a
responsive browser application that can run on a phone or a PC and connect
directly to the main ESP32 over local Bluetooth Low Energy (BLE).

The browser app is a control surface, not a second safety controller. The
ESP32 remains responsible for authorization, command validation, motor output,
timeouts, and stopping on disconnect or fault. The physical motor cut-off is
always independent of this app.

## Planned stack

- **Language:** TypeScript with strict compiler checks.
- **UI:** React with semantic components, responsive CSS, touch-friendly
  controls, and a prominent software STOP.
- **Build tooling:** Vite for local development and a static production build.
- **BLE transport:** the browser Web Bluetooth API using the rover's documented
  GATT service, command characteristic, and status characteristic.
- **Packaging:** installable Progressive Web App (PWA) for supported mobile
  browsers, while remaining usable as a normal browser page on a PC.
- **Testing:** unit tests for command encoding, bounds, sequence handling, and
  telemetry parsing; browser/device tests for BLE connection, disconnect, STOP,
  reconnect, and disabled controls.

The first implementation should target Chromium-based browsers with Web
Bluetooth support. The app must detect unsupported browsers and show a clear
connection error rather than offering controls that cannot work. BLE access
normally requires a secure context (`https://` or localhost), a user gesture,
and explicit device permission.

Recommended React structure:

```text
phone-app/
├── src/
│   ├── app/          React shell and safety-oriented screen state
│   ├── ble/          Web Bluetooth connection and GATT adapter
│   ├── protocol/     command encoding and telemetry parsing
│   ├── components/   reusable controls and telemetry cards
│   └── styles/       responsive phone/PC presentation
├── public/           PWA manifest and static assets
└── README.md
```

Keep BLE and protocol code in non-visual modules. React components should
render connection/safety state and request actions through those modules,
rather than writing GATT characteristics directly from UI event handlers.

## Interface contract

### Rover connection

The app scans for the configured rover BLE service and subscribes to its status
characteristic. It must display:

- disconnected, connecting, connected, and permission/error states;
- `DISARMED`, `MANUAL`, `SAFE_STOP`, and `FAULT`;
- last command acknowledgement or rejection and its sequence number;
- timeout, disconnect, authorization, and other fault events.

### Commands

The app sends only the bounded Phase 1 command frame:

```text
CMD,<version>,<sequence>,<arm>,<forward>,<turn>,<stop>
```

For version `1`, `forward` and `turn` are each limited to `-1.0..1.0`.
Sequence numbers must increase. Arm, disarm, and STOP are explicit actions;
the app must never auto-arm or resume motion after reconnect. STOP must be
available without navigating away from the driving screen.

The app should send commands at a controlled cadence while driving and stop
sending motion updates when the control is released, the link is lost, the
rover reports a fault, or the app is backgrounded. A phone STOP is not a
replacement for the hardware cut-off.

### Telemetry

Every displayed measurement must preserve the rover's unit, validity, and
timestamp or age. Render `unavailable`, `invalid`, `stale`, and `simulated`
distinctly; never turn a missing reading into zero. The initial dashboard
follows the illustrative overview:

- BLE link and safety state;
- arm/disarm and joystick axes;
- software STOP;
- GPS status;
- heading/IMU status;
- temperature/humidity;
- battery data only when instrumented and valid;
- camera and storage status;
- recent safety and sensor events.

The illustrative HTML is a UI reference only. Its example values and
connected/valid states are not hardware evidence and must not be copied as
real telemetry defaults.

## Browser and safety constraints

- Use local BLE only; no Wi-Fi, cloud, MQTT, public endpoint, or remote control
  path is part of Phase 1.
- Keep BLE permission and device identifiers out of logs and screenshots.
- Disable movement controls when disconnected, disarmed, faulted, unsupported,
  or awaiting an explicit arm action.
- Treat status notifications as authoritative for command success; local writes
  alone are not acknowledgements.
- Handle page visibility changes and browser suspension conservatively by
  stopping motion commands and requiring re-arm.
- Do not claim cryptographic authentication, secure boot, or production safety
  certification from browser BLE pairing alone.

## Future additions

Future folders may add a dashboard component library, protocol types shared
with firmware, camera status views, sensor adapters, and test fixtures. Keep
these additions behind transport and telemetry interfaces so camera, SD, or
sensor work cannot block the control path.

## Implementation status

This folder now contains the Phase 1 operator console implementation.

### Run locally

```bash
npm install
npm run dev
```

Open the printed URL in a Chromium-based browser. Web Bluetooth requires a
secure context (`https://` or `localhost`). Use **Demo: on** to exercise the UI
without hardware; demo values are explicitly labelled as simulated.

### Test and check

```bash
npm test        # protocol, reducer, demo adapter, Web Bluetooth transport, useRover
npm run lint
npm run build   # TypeScript check + production bundle
```

The Web Bluetooth tests use a mocked GATT device, so they verify the UUIDs,
notification decoding, write path, disconnect handling, and re-arm semantics
without hardware. They cannot prove radio-level pairing.

### Real rover checklist

1. Set `board::AUTHORIZED_CENTRAL_ADDRESS` in `firmware/include/board_config.h`
   to the controlling device's BLE address. The shipped empty value rejects
   every central by design.
2. Pair/bond with the ESP32 passkey when the operating system asks.
3. Serve the app over `https://` or `localhost` (Web Bluetooth requirement).
4. Confirm the rover reports `DISARMED` after connecting, then arm explicitly.
   Reconnecting never resumes motion.

### Build

```bash
npm run build
npm run preview
```

### Structure

```text
phone-app/
├── public/           PWA manifest and static assets
└── src/
    ├── app/          React shell, reducer, and rover control hook
    ├── ble/          Web Bluetooth adapter and demo adapter
    ├── protocol/     command encoding and telemetry parsing
    ├── components/   reusable controls and telemetry cards
    └── styles/       design tokens and responsive presentation
```

BLE and protocol code remain non-visual. React components render connection and
safety state and request actions through `useRover`.
