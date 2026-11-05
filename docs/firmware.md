# Firmware

## One-week target

Build the smallest reproducible firmware that boots, initializes the drive hardware safely, accepts a small set of local commands, reports status, and stops on command timeout or invalid state. Use the board and framework the team can build with immediately. Avoid feature expansion until the basic stop behavior is tested.

## Suggested modules

```text
main / setup
├── board_config        pin map and safe output defaults
├── drive               speed-limited left/right motor commands
├── command_handler     allowlist, range checks, stop command
├── connection          local Wi-Fi or BLE events
├── status              mode, connection, fault, battery if available
└── failsafe            command timeout → motor output disabled
```

Keep the message format simple and versioned. Example command names: `STOP`, `FORWARD`, `REVERSE`, `LEFT`, `RIGHT`. Reject unknown command names and values outside the agreed speed limit. Do not store secrets in source control or print them to serial logs.

## Daily checkpoints

- **Day 1:** Confirm toolchain, board, pins and safe initial output state.
- **Day 2:** Build and flash a “motors disabled” test program; verify stop/disable wiring.
- **Day 3:** Add bounded drive commands and status response.
- **Day 4:** Integrate connectivity and dashboard; test invalid input and disconnect timeout.
- **Day 5:** Freeze features, record build/flash steps, test from a clean restart.

## Acceptance checks

- [ ] Build instructions work on a clean checkout.
- [ ] Motors remain off at boot and reset.
- [ ] Only allowed commands and bounded values are accepted.
- [ ] `STOP` disables motor output.
- [ ] Loss of control messages triggers a stop within the team’s tested timeout.
- [ ] Status shows connection and fault state without exposing credentials.

## Not in scope this week

Secure boot/key provisioning, OTA, cloud command services, ML-based anomaly detection, and advanced closed-loop autonomy are deferred unless already implemented and easy to verify. Document any such feature as untested rather than claiming it is secure.
