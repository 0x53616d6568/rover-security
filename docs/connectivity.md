# Connectivity

## One-week choice

Choose **one** local link that the available hardware supports. A simple ESP32 access point with a local web dashboard is a good default if the team already knows the stack. BLE is an alternative if a working app/client is already available. Do not add cloud/MQTT unless the class requirement demands it and the team can test it safely.

## Minimal message contract

Commands: `STOP`, `FORWARD`, `REVERSE`, `LEFT`, `RIGHT`. Optional numeric speed must be clamped to the agreed demo limit. Status: `connected`, `mode`, `last_command`, and `fault`; include sensor/battery values only if available and labeled accurately.

Use a short timeout measured on the actual system. On disconnect or stale commands, firmware disables the drive output and shows a disconnected/stopped state. The precise timeout is a demo setting to test, not a security guarantee.

## Tasks

- [ ] Day 1: choose Wi-Fi local AP or BLE and record board/client requirements.
- [ ] Day 2: agree command and status fields with the firmware owner.
- [ ] Day 3: connect dashboard and rover using a local test.
- [ ] Day 4: test disconnect, reconnect, malformed command, and duplicate command.
- [ ] Day 5: document connect steps and show the link working in the demo.

## Basic safeguards

Keep the rover on an isolated/local network. Do not port-forward it or use public broker credentials. Allow only the small demo command set, reject malformed input, and do not include passwords or keys in screenshots, commits, or serial output. This is a classroom prototype, not a hardened remote-control service.
