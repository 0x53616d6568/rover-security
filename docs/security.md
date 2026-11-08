# Security and safety checklist — Phase 1

This is a supervised classroom prototype plan, not a security certification or production-safety case.

## Before motor tests

- [ ] Identify the exact ESP32, ESP32-CAM, drivers, motors, battery, protection, wiring, and sensors; verify ratings from the actual hardware/datasheets.
- [ ] Confirm logic outputs remain inactive at boot/reset; start DISARMED.
- [ ] Test the physical motor power/disable path independently of the app, BLE link, and normal firmware loop.
- [ ] Use wheels lifted for initial drive tests, low speed, clear controlled ground-test area, operator in view, spotter present, physical cut-off reachable.
- [ ] Stop immediately if there is unexpected movement, heat, smell, unstable supply, or a failed STOP/cut-off test.

## During the demo

- [ ] BLE only for local phone control; pair/authorize the intended phone and reject other/invalid commands.
- [ ] Bound inputs, show connection/mode/fault/measurement age, disable drive when disconnected.
- [ ] On disconnect, stale command, reset, or fault: stop and require explicit re-arm; do not restart automatically.
- [ ] Test and measure the timeout on the actual rover. The requirements document gives a 500 ms target after command expiry; this remains a target until measured and accepted.
- [ ] Keep controls off the public internet. Do not use port forwarding, public brokers, cloud control, or committed credentials.
- [ ] Keep persons, roads, stairs, and fragile equipment out of the test area.

## Evidence to retain

Record firmware/build version, wiring revision, test conditions, STOP and physical cut-off tests separately, measured disconnect-stop time, invalid-command results, sensor availability/age behavior, repetitions, and unresolved defects. Mark any mock/simulated telemetry clearly.

## Claims not established by this plan

Do not claim secure boot, encrypted storage, secure OTA, cryptographic message authentication, resistance to jamming/GPS spoofing, obstacle avoidance, person detection, standards compliance, or complete security unless that exact feature is implemented and tested on the real hardware. BLE pairing and a software STOP alone are not proof of a secure or safe production system.
