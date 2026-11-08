# MQTT split architecture — telemetry and command planes

> **Implemented in source, not yet validated end-to-end on hardware.**
>
> The rover and dashboard now use two independent MQTT brokers: one for
> telemetry and one for commands. BLE remains an alternate local control path.
> Do not claim broker acceptance until both links are tested with the real
> HiveMQ clusters and the physical stop has been verified.

## Why two brokers

A single broker shared by telemetry and commands means any credential that can
read telemetry can also publish a drive command. Splitting the traffic creates
two independent trust boundaries:

- **Telemetry plane** — read-only for the dashboard, publish-only for the rover.
- **Command plane** — publish-only for the dashboard, subscribe-only for the
  rover.

A leaked telemetry credential cannot move the rover. A leaked command credential
cannot inject fake sensor data.

## Topology

```text
                     ┌─────────────────────────────────────┐
                     │ Dashboard (browser, phone/PC)       │
                     │  telemetry client : subscribe only  │
                     │  command client   : publish only    │
                     └───────┬───────────────────┬─────────┘
                             │ wss :8884         │ wss :8884
                             ▼                   ▼
                  ┌──────────────────┐   ┌──────────────────┐
                  │ Broker T         │   │ Broker C         │
                  │ TELEMETRY        │   │ COMMAND          │
                  │ publish: rover   │   │ publish: dash    │
                  │ subscribe: dash  │   │ subscribe: rover │
                  └────────▲─────────┘   └─────────┬────────┘
                           │ mqtts :8883           │ mqtts :8883
                           │                       ▼
                     ┌─────┴─────────────────────────────┐
                     │ ESP32 rover                       │
                     │  telemetry link : publish only    │
                     │  command link   : subscribe only  │
                     │  BLE : optional local control     │
                     └───────────────────────────────────┘
```

Both brokers are HiveMQ Cloud clusters and both require TLS and a username /
password. The ESP32 uses raw MQTT over TLS on **8883**; the browser cannot open
raw MQTT sockets, so the dashboard uses WebSocket TLS on **8884** with path
`/mqtt`.

## Topic contract

The base prefix is `rover/<ROVER_ID>` with `ROVER_ID = "1"` in
[`firmware/include/board_config.h`](../firmware/include/board_config.h). Change
that value (and the dashboard topic variables) before using more than one rover.

| Broker | Topic | Publisher | Subscriber | QoS | Retain |
|---|---|---|---|---|---|
| **T — telemetry** | `rover/1/telemetry` | Rover | Dashboard | 1 | No |
| **T — telemetry** | `rover/1/availability` | Rover (LWT) | Operator MQTT client (dashboard support pending) | 1 | **Yes** |
| **C — command** | `rover/1/command` | Dashboard | Rover | 1 | **No** |

### HiveMQ Access Management — use the default permission entries

HiveMQ Cloud already provides three protected entries, all with topic filter
`#`:

- **Subscribe Only** — subscribe to the whole tree, no publishing.
- **Publish Only** — publish to the whole tree, no subscribing.
- **Publish and Subscribe** — both directions.

**Delete any custom entry you created** (for example `Rover_1_command` with
topic filter `rover/1/command`). No per-topic filters are needed; the split is
per broker.

Use one credential per role and assign the default entry:

| Broker | Role | Permission entry | Used by |
|---|---|---|---|
| T — telemetry | rover | **Publish Only** | ESP32 telemetry link |
| T — telemetry | dashboard | **Subscribe Only** | browser telemetry link |
| C — command | rover | **Subscribe Only** | ESP32 command link |
| C — command | dashboard | **Publish Only** | browser command link |

Notes:

- The `Name` column on that screen is the **permission entry**, not an MQTT
  client ID. MQTT client IDs are assigned by the firmware and dashboard and
  stay unique per link; do not enter them into HiveMQ.
- If the cluster exposes the defaults as ready-made credentials, use them
  directly; otherwise create a credential with any username and select the
  matching default entry.
- Never assign **Publish and Subscribe** to either role — that would undo the
  split.
- Each broker has its own copy of the default entries, so the same entry names
  on Broker T and Broker C are independent.
- Put the credential username/password in `secrets.h` and `.env.local`, never in
  the repository.

Rotate credentials when anyone with access leaves the project.

## Payload contract

**Command** (`rover/1/command`):

```text
CMD,<version>,<sequence>,<arm>,<forward>,<turn>,<stop>
CMD,1,42,1,0.25,-0.10,0
```

- `version` = `1`
- `sequence` strictly increases; a duplicate/regressing value triggers
  `SAFE_STOP`
- `arm` and `stop` are `0` or `1`
- `forward` and `turn` are bounded to `[-1.0, 1.0]`
- maximum payload length: `BLE_MAX_FRAME_LENGTH` (64 bytes)

**Telemetry** (`rover/1/telemetry`):

```text
STATE=MANUAL;EVENT=ACCEPTED;SEQ=42;SENSOR_DATA=available;...;AGE_MS=120
```

Every reading must carry validity and age. Missing data stays explicitly
`unavailable` / `invalid` / `stale`; never substitute zero.

**Availability** (`rover/1/availability`, retained):

```text
online
offline
```

The rover registers `offline` as its MQTT last will and publishes `online`
retained after connecting. The dashboard currently subscribes only to
`rover/1/telemetry`; the availability topic is available for an operator
client or a later dashboard change to show a dead rover before the next
telemetry frame arrives.

## Connection settings

| Side | URL | Port | Protocol |
|---|---|---|---|
| ESP32 → Broker T | `mqtts://<telemetry-host>` | 8883 | MQTT over TLS |
| ESP32 → Broker C | `mqtts://<command-host>` | 8883 | MQTT over TLS |
| Dashboard → Broker T | `wss://<telemetry-host>:8884/mqtt` | 8884 | WebSocket TLS |
| Dashboard → Broker C | `wss://<command-host>:8884/mqtt` | 8884 | WebSocket TLS |

Current broker assignment (swap in configuration if the team reverses it):

- **Broker T (telemetry):** `dd4bee3682e2479fbe315b7d4670285f.s1.eu.hivemq.cloud`
- **Broker C (command):** `cbe3900b046e42cba6060cb5790fbe1d.s1.eu.hivemq.cloud`

Both links use unique client IDs. HiveMQ rejects duplicate IDs; never reuse the
same ID from two tabs or two devices.

## Firmware configuration

Copy [`firmware/include/secrets.h.example`](../firmware/include/secrets.h.example)
to `firmware/include/secrets.h` (gitignored) and fill in:

```cpp
constexpr char WIFI_SSID[] = "...";
constexpr char WIFI_PASSWORD[] = "...";

// Telemetry broker — publish only
constexpr char MQTT_TELEMETRY_HOST[] = "...";
constexpr uint16_t MQTT_TELEMETRY_PORT = 8883;
constexpr char MQTT_TELEMETRY_USER[] = "...";
constexpr char MQTT_TELEMETRY_PASS[] = "...";

// Command broker — subscribe only
constexpr char MQTT_COMMAND_HOST[] = "...";
constexpr uint16_t MQTT_COMMAND_PORT = 8883;
constexpr char MQTT_COMMAND_USER[] = "...";
constexpr char MQTT_COMMAND_PASS[] = "...";
```

`RoverController` creates two `MqttLink` instances:

- `telemetryLink_` — publish-only; owns `rover/1/telemetry` and the retained
  availability LWT.
- `commandLink_` — subscribe-only; feeds `rover/1/command` into the existing
  bounded `acceptFrame()` validator.

The telemetry broker is never subscribed. The command broker never publishes
telemetry.

## Dashboard configuration

Copy [`phone-app/.env.example`](../phone-app/.env.example) to
`phone-app/.env.local` (gitignored) and fill in:

```text
VITE_MQTT_TELEMETRY_URL=wss://<telemetry-host>:8884/mqtt
VITE_MQTT_TELEMETRY_USER=...
VITE_MQTT_TELEMETRY_PASS=...
VITE_MQTT_TELEMETRY_TOPIC=rover/1/telemetry

VITE_MQTT_COMMAND_URL=wss://<command-host>:8884/mqtt
VITE_MQTT_COMMAND_USER=...
VITE_MQTT_COMMAND_PASS=...
VITE_MQTT_COMMAND_TOPIC=rover/1/command
```

The dashboard creates one telemetry client (subscribe) and one command client
(publish). It reports `connected` only when both are up; arming requires the
command link.

## Safety and failure behavior

- **Command timeout:** 500 ms. The dashboard republishes the active joystick
  frame every 150 ms; release sends a zero axis frame, and STOP/disarm sends an
  explicit frame.
- **Command link lost:** no new commands arrive, the timeout forces
  `SAFE_STOP`, and no motion resumes automatically after reconnect.
- **Telemetry link lost:** the dashboard loses state/telemetry and must show it;
  it does not by itself stop the rover. The operator should stop if they can no
  longer see state.
- **Reconnect policy:** the firmware does not reconnect either MQTT link while
  in `MANUAL` because a TLS reconnect can block for seconds. Reconnection is
  retried once the rover is disarmed/stopped.
- **Command broker is the control boundary:** broker authentication is the only
  authorization on this path. Anyone who can publish to `rover/1/command` can
  drive the rover. Treat the command broker credentials as control credentials,
  not as read-only analytics credentials.
- **Physical stop:** independent of both brokers, BLE, and the dashboard.

## HiveMQ Cloud setup checklist

1. Create two clusters (or reuse the existing telemetry cluster and add a
   dedicated command cluster).
2. In **Access Management**, delete any custom permission row and use the
   default **Publish Only** / **Subscribe Only** entries with topic filter `#`.
   Assign one credential per role as shown in the table above.
3. Do not mix default permissions: no credential gets **Publish and Subscribe**
   on either broker.
4. Keep TLS enabled: `8883` for ESP32, `8884` for browser WebSockets.
5. Never publish commands with the retain flag; the app and firmware both send
   commands with `retain = false`.
6. Confirm with an MQTT client:
   - subscribe to `rover/1/#` from an admin account;
   - publish a test `CMD,1,1,0,0,0,1` and confirm the rover replies with
     `STATE=DISARMED;EVENT=STOP;SEQ=1`;
   - disconnect the rover and confirm `rover/1/availability` becomes `offline`;
   - verify the permissions: the dashboard telemetry credential cannot publish,
     and the rover command credential cannot publish.
7. Record the tested broker hostnames, credential roles, and results in this
   document.

## Open items

- [ ] Command broker credentials and default-permission confirmation.
- [ ] Replace `setInsecure()` with the HiveMQ CA pinned on both links.
- [ ] Decide whether telemetry loss should force a stop (currently it does not).
- [ ] Rotate any credentials that were previously committed to the repository.
