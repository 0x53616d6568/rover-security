# Connectivity — Phase 1

## Decision

The rover has two control/telemetry paths:

- **Command plane:** dashboard → command broker → main ESP32. The dashboard is
  the only source of motion commands on this path. The rover subscribes; it
  never publishes telemetry on this broker.
- **Telemetry plane:** main ESP32 → telemetry broker → dashboard. The rover
  publishes; it never subscribes to commands on this broker.
- **BLE:** retained as an alternate local control path for bring-up and
  bench testing.

The two MQTT brokers and their topic/credential split are documented in
[MQTT split architecture](mqtt-architecture.md). The ESP32-CAM is not a
controller and has no motor authority on any path.

## Minimal contract

- **Dashboard → rover:** protocol version, sequence number, arm/disarm state,
  bounded longitudinal and turn axes, and explicit STOP.
- **Rover → dashboard:** connection and operating state, last accepted
  sequence/command, acknowledgement or rejection, fault code, plus sensor
  readings with units, validity, and age.
- Unknown, malformed, stale, out-of-range, or unauthorized commands are rejected
  and shown as a fault/status—not silently accepted.
- A STOP request is prioritized, but it is not a replacement for the independent
  physical motor cut-off.
- Camera capture/status may be relayed through the main controller. Camera
  traffic must never delay or activate motor control.

The exact GATT service/characteristic UUIDs, frame encoding, pairing mode,
sequence handling, and any CRC are documented in the firmware and must be
agreed before a hardware claim is made. Do not claim cryptographic
authentication unless it is implemented and tested.

## Loss-of-control behavior

Use a dead-man/command timeout. The requirements document sets a nominal target
of 500 ms after command expiry; measure actual behavior on the prototype and
record the result. On disconnect, stale command, controller reset, or invalid
frame: set motion to zero, disable drive output as designed, show
STOPPED/FAULT, and require explicit re-arm after recovery. Do not resume
movement automatically after reconnect.

If the telemetry broker drops, the dashboard must show the loss immediately. It
does not currently force a stop; the operator should stop if they can no longer
see rover state.

## Five-day checkpoints

- [ ] **Day 1:** confirm that the phone and exact ESP32 board support the
      proposed paths; freeze the command/state fields.
- [ ] **Day 2:** verify BLE and both broker connections without enabling motor
      power; confirm unarmed startup.
- [ ] **Day 3:** implement bounded joystick commands, STOP priority,
      acknowledgements and dashboard status.
- [ ] **Day 4:** test disconnect, reconnect, stale sequence, malformed frame,
      unauthorized client and timeout on hardware.
- [ ] **Day 5:** freeze the tested protocol/build and document how to pair,
      recover, and stop.

Keep the demo controlled. Do not expose an unauthenticated broker, commit
passwords/tokens/private keys, or put credentials into logs or screenshots.
Broker authentication is the only authorization on the command path, so treat
command-broker credentials as control credentials. BLE pairing alone is not a
complete security guarantee.
