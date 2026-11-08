# ENISOLAR Rover — Phase 1 Plan (v1.2)

This repository is the planning baseline for a supervised, one-week rover demonstration. It is **not** a completed firmware, phone app, or dashboard implementation. The team must record only behavior that has been built and tested on the actual hardware.

## Confirmed Phase 1 scope

- A normal all-terrain rover, manually guided by an operator from a phone over **local BLE**.
- **One main ESP32** owns motor control, safety state, sensor acquisition, and telemetry aggregation.
- One **ESP32-CAM** is an auxiliary image-capture device; it has no authority over the motors.
- Preserve the sensors actually fitted and validated: GPS, IMU, magnetometer, wheel encoders, DHT22, and electrical measurements only when instrumented. The LiDAR mentioned in the historical blueprint is optional and its presence/interface must be confirmed.
- A phone dashboard shows BLE connection, operating state, faults, and sensor values with units, validity, and age. Missing or stale readings are explicitly marked.
- No Wi-Fi/cloud control, timed route, waypoint, AUTO mode, obstacle avoidance, or intelligent security action in Phase 1.

The second ESP32, intelligent navigation/perception, and the future embedded-security project are **later extensions**, after the Phase 1 platform, power system, telemetry, and stop behavior are reviewed.

## Five-day demonstration plan

| Day | Milestone | Exit evidence |
|---|---|---|
| 1 | Inventory hardware, confirm parts and scope, review pin/power map and test area | Actual inventory and reviewed wiring/risk list; no guessed ratings or pins |
| 2 | Safe bring-up: logic first, motors inactive at boot/reset, verify physical stop | Logged electrical checks and independent stop test before powered movement |
| 3 | BLE manual commands and initial phone dashboard | Authorized, bounded commands; connection/state/fault display; missing sensors marked unavailable |
| 4 | Integration and negative tests | Measured stop-on-timeout; tests for disconnect/reconnect, invalid frames, sensor faults, reboot and camera/SD failure |
| 5 | Freeze and rehearse | Three repeatable, low-speed manual runs, final wiring/build notes and disclosed limitations |

This is a proposed schedule, not a delivery guarantee. If parts, safety checks, or real measurements are unavailable, use a simulator or mocked values clearly labelled as simulated; do not represent them as hardware telemetry.

## Team responsibilities

- **Person 1 — electronics/core firmware:** actual inventory, power and pin map, motor outputs OFF at boot/reset, bounded commands, physical stop and timeout behavior.
- **Person 2 — BLE/phone control:** BLE service, pairing/authorization, joystick, command sequence and state acknowledgement, loss/reconnect tests.
- **Person 3 — dashboard/telemetry/acceptance:** connection/mode/faults, measurement validity and age, integrated test log, camera/SD only if stable.

Integrate daily on a known-good build. First motor tests are with the wheels lifted; ground tests are low-speed in a clear controlled area with a spotter and physical cut-off accessible. A phone STOP is not a substitute for a tested hardware cut-off.

## Documents and deliverables

- [Revised ENISOLAR requirements and risk analysis v1.2](docs/Cahier_des_charges_Rover_ENISOLAR_v1.2.pdf)
- [Five-day project plan PDF](docs/project-plan.pdf)
- [Editable Typst source for the project plan](docs/typst-source/main.typ)
- [Rover blueprint and confirmed-vs-unconfirmed hardware](docs/Rover%20blueprint.md)
- [Wiring schematic / bring-up checklist](docs/wiring-schematic.md)
- [Firmware requirements](docs/firmware.md)
- [BLE connectivity and protocol](docs/connectivity.md)
- [Dashboard and telemetry contract](docs/dashboard.md)
- [Phone app stack and BLE interface](phone-app/README.md)
- [Navigation scope and future gate](docs/navigation.md)
- [Security and test checklist](docs/security.md)

## Safety and status

Use only in a controlled demonstration area. Do not expose rover controls to the public internet. Verify component ratings and the physical stop before motor tests. Stop testing on unexpected movement, overheating, or a failed stop path. This plan does not claim production security, safety certification, or completed implementation.
