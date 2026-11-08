# Firmware — Phase 1

## Target

Build the smallest reproducible firmware for a manually guided all-terrain rover. One main ESP32 owns motor outputs, safety state, BLE command handling, sensor sampling, telemetry aggregation, and camera requests. An ESP32-CAM is auxiliary only. The second ESP32 and autonomous/intelligent behavior are deferred.

The first implementation is under [`firmware/`](../firmware/). It is a conservative bring-up build: motor pins and the authorized phone address are unset until the actual hardware is checked, so it will advertise BLE and report unavailable drive hardware but will not move a motor by default.

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

## Initial firmware layout and protocol

The PlatformIO project is split so future sensors and the camera link can be added without putting their work in the control loop:

```text
firmware/
├── include/
│   ├── board_config.h    verified hardware settings only
│   ├── ble_control.h     BLE transport boundary
│   ├── drive.h           bounded differential-drive output
│   └── safety_state.h    shared safety states
├── src/main.cpp          Arduino lifecycle only
├── src/rover_controller.cpp
│                         safety loop and command validation
├── src/ble_control.cpp   BLE callbacks, authorization and notifications
├── src/drive.cpp         bounded differential-drive output
├── src/safety_state.cpp  state names
└── platformio.ini
```

The command characteristic accepts one bounded ASCII frame:

```text
CMD,<version>,<sequence>,<arm>,<forward>,<turn>,<stop>
```

`version` is `1`, `sequence` must increase, `arm` and `stop` are `0` or `1`, and both axes must be between `-1.0` and `1.0`. A valid example is `CMD,1,7,1,0.25,-0.10,0`. State notifications use semicolon-delimited fields and always include the safety state; sensor data is currently explicitly marked unavailable.

Before a real build, set the verified PWM/direction/enable pins and the paired phone BLE address in [`board_config.h`](../firmware/include/board_config.h). An empty address rejects every BLE central, and unset motor pins keep the drive unavailable. The current drive adapter assumes one PWM and one direction signal per side; adapt it only after the actual driver interface is reviewed.

## Local build

From the repository root, with PlatformIO installed:

```text
pio run -d firmware
pio device monitor -d firmware -b 115200
```

No hardware acceptance result is claimed by this source-only implementation. Flashing, physical cut-off testing, timeout measurement, pairing, and the acceptance checklist remain to be completed on the verified board and wiring.
