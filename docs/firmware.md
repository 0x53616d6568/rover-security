# Firmware — Phase 1

## Target

Build the smallest reproducible firmware for a manually guided all-terrain rover. One main ESP32 owns motor outputs, safety state, BLE command handling, sensor sampling, telemetry aggregation, and camera requests. An ESP32-CAM is auxiliary only. The second ESP32 and autonomous/intelligent behavior are deferred.

No firmware implementation is currently included by this planning document; update acceptance checkboxes only after testing on the actual board.

## Suggested responsibilities

```text
main / setup
├── board_config       verified pin map; safe output defaults
├── safety_state       BOOT_SAFE, DISARMED, MANUAL, SAFE_STOP, FAULT
├── drive              differential left/right control; limits and ramp
├── ble_control        allowlist, pairing/authorization, bounded frames
├── sensor_manager     GPS, IMU, magnetometer, encoders, DHT22, fitted power sensors
├── telemetry          units, timestamp/age, validity, dashboard notifications
├── camera_link        auxiliary request/status with timeout and acknowledgement
└── failsafe           command expiry, watchdog/reset, motor output inactive
```

Only include a sensor as fitted after checking the hardware inventory. Treat LiDAR as optional/unconfirmed. A sensor fault must be visible and must not create an invented reading or an unreviewed autonomous action.

## Required behavior

1. Boot and reset with motor outputs inactive; start DISARMED and require explicit arm after checks.
2. Accept movement commands only from the authorized connected BLE client; use bounded forward/reverse and turn axes for differential drive.
3. Reject malformed, stale, out-of-range, unknown, or unauthorized commands. Keep STOP priority above joystick updates.
4. Stop on command expiry/disconnect/fault; the target is no more than 500 ms after the configured command-expiration point, subject to measurement on the real controller. Do not auto-resume after reconnect.
5. Publish state and telemetry with unit, validity, timestamp or age, and fault status. Distinguish zero from unavailable/stale.
6. Keep camera and SD tasks non-blocking with respect to control. Camera errors must not enable or delay motor commands.

## Daily checkpoints

- **Day 1:** confirm board/toolchain, actual pins/ratings, inventory, safe output state and interface ownership.
- **Day 2:** flash a motors-disabled bring-up build; test physical stop independently.
- **Day 3:** add bounded manual BLE commands and initial state/telemetry output.
- **Day 4:** integrate sensors/dashboard; measure timeout and test invalid input, sensor loss, reboot and camera/SD failure.
- **Day 5:** freeze a known-good build, rehearse three times, record flash/recovery procedure and limitations.

## Acceptance checklist

- [ ] Clean build/flash steps documented with board and firmware version.
- [ ] Motors inactive at boot/reset and after disarm.
- [ ] Physical cut-off tested separately from phone STOP.
- [ ] Only allowed, bounded commands accepted from the authorized BLE session.
- [ ] Timeout behavior measured on hardware; no motion resumes automatically.
- [ ] Dashboard receives state/fault and correctly marks invalid, absent, stale, or simulated data.
- [ ] Sensor, SD, or camera failure cannot block the safety/control path.

Autonomous navigation, waypoints, object detection, obstacle avoidance, cloud control, secure boot, secure OTA, HMAC, and production safety certification are not Phase 1 deliverables.
