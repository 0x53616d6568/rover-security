# Phone dashboard — telemetry contract

## Goal

Provide a readable phone interface for manual drive and telemetry over the split MQTT links (telemetry broker for reads, command broker for writes), with BLE as an alternate local path. Keep a prominent software STOP, show link and safety state immediately, and prevent commands when the rover is disconnected or not ready. The software STOP does not replace the physical cut-off.

Product access is user-managed: the **Fleet** screen associates rover bindings to owners, and rover telemetry/control is available only through a selected rover. Add/remove/select controls appear only for the signed-in owner; the API enforces the same ownership rule.

## Minimum screen

- **Control/safety:** command-link connected/disconnected, telemetry-link status, DISARMED / MANUAL / SAFE STOP / FAULT, joystick axes, arm/disarm, STOP, quality/age of the last command, acknowledgement/rejection.
- **Fleet:** owners and rover bindings; one active rover can be selected at a time.
- **Power:** battery voltage and alerts only if a divider/measurement is actually installed and calibrated; current only when the selected driver/sensor output is verified.
- **Motion:** encoder-derived left/right speed if encoders are fitted and calibrated; IMU inclination/angular rate and compass heading only with validity/calibration status.
- **GPS:** fix validity, coordinates, satellites, HDOP and age; informational in Phase 1, not an autonomous route.
- **Environment:** DHT22 temperature/humidity if physically present.
- **Optional sensor:** LiDAR distance/status only if its exact module, interface, and data quality have been confirmed; do not present it as certified collision protection.
- **Camera:** ESP32-CAM available/unavailable, result and time/id of last capture, SD/error status when exposed.
- **Events:** recent stop, timeout, disconnect, sensor, battery, camera, and SD faults with time/severity.

## Data-quality rules

Every measurement must include a unit, validity, and timestamp or age. Show **unavailable**, **invalid**, **stale**, and **simulated** distinctly; never render a missing sensor as zero or as real hardware data. Any simulated/mock value must be explicitly labelled.

Do not show “command succeeded” unless the rover reports acknowledgement/current state for it. Disable motion controls when disconnected, faulted, or not armed. Connection loss and safety-state changes should be prominent and immediate.

The operator shell keeps command MQTT status, safety state, and telemetry age
visible in the header at all times. Telemetry loss is reported but does not by
itself grant or revoke motion authority; command-link loss blocks motion until
the operator re-arms. There is no automatic resume after a link drop, fault, or
page hide.

## Five-day tasks

- [ ] **Day 1:** list real sensors/fields and sketch connection, mode, fault, STOP and data freshness.
- [ ] **Day 2:** implement connection/safety-state view with motor control not yet enabled.
- [ ] **Day 3:** add joystick, STOP, bounded commands, acknowledgement and sensor cards.
- [ ] **Day 4:** test absent/stale sensor, disconnect/reconnect, rejected command, fault, reboot and camera/SD errors.
- [ ] **Day 5:** rehearse on the target phone, preserve screenshots only with secrets removed, and record remaining limitations.

## Acceptance

An operator can tell whether the rover is connected, armed, moving, stopped, faulted, and whether each displayed reading is fresh and valid. The stop control is immediately available. The dashboard never permits driving while disconnected and never implies a command or sensor is successful without corresponding evidence. A rover command page is reachable only through a rover selected from the Fleet list; when that rover is disconnected, controls stay disabled.
