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

## Attack-type exercises

The security work is split into tracked attack types. See the [attack type registry](attack-types.md) before running any test.

- **AT-01 — BLE discovery / GATT enumeration:** read-only radio assessment; do not write to the command characteristic in that procedure.
- **AT-02 — Illogical command injection:** design-level analysis of destructive or state-inverting frames; requires a separate, hardware-supervised test if ever executed.
- **AT-03 — ESP32 flash extraction / NVS credential recovery:** local, read-only extraction of Wi-Fi and MQTT material from firmware and NVS. Use the [sanitized workbench](../attacks/esp32-firmware-extraction/README.md) only on project-owned hardware.

For AT-03, keep all dumps, extracted partitions, and unredacted reports outside git. Never commit SSIDs, passwords, broker credentials, certificates, private keys, or raw report lines. Recovered credentials must be rotated; deleting an NVS value is not rotation.

## Evidence to retain

Record firmware/build version, wiring revision, test conditions, STOP and physical cut-off tests separately, measured disconnect-stop time, invalid-command results, sensor availability/age behavior, repetitions, and unresolved defects. Mark any mock/simulated telemetry clearly.

## Claims not established by this plan

Do not claim secure boot, encrypted storage, secure OTA, cryptographic message authentication, resistance to jamming/GPS spoofing, obstacle avoidance, person detection, standards compliance, or complete security unless that exact feature is implemented and tested on the real hardware. BLE pairing and a software STOP alone are not proof of a secure or safe production system.
