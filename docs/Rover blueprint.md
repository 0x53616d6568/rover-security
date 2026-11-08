# Rover blueprint — Phase 1 baseline

This is a **block-level planning guide**, not a pin-by-pin electrical schematic. The Phase 1 decision below supersedes the older two-controller proposal. Confirm every actual board, pin, voltage, connector, and current rating before wiring. The repository currently contains planning documents, not a validated physical build or firmware implementation.

## Current architecture

```text
Phone dashboard / joystick
       │ local BLE: manual commands + telemetry
       ▼
Main ESP32 — sole Phase 1 motion authority
   ├── motor driver(s) → left/right drive motors
   ├── existing fitted sensors → timestamp/validity → phone telemetry
   ├── storage (if fitted) → non-blocking data/event logging
   └── auxiliary command/status link (interface TBD)
          ▼
      ESP32-CAM — image capture only; no motor authority

Battery → verified protection/fuse/switch → motor power path
        └→ correctly rated regulated logic supplies
Physical stop → independent hardware motor-disable/power path (must be verified)
```

BLE is the only Phase 1 phone-to-rover control link. Do not add Wi-Fi, MQTT, cloud control, or remote operation to the one-week demonstration. Pin assignments, bus addresses, UART protocol, and exact camera supply are open decisions until checked against actual boards.

## Phase 1 sensor inventory

Carry forward sensors only when physically present, wired, and validated:

| Device | Data candidate | Confirmation needed |
|---|---|---|
| NEO-6M GPS | Fix, coordinates, satellites, HDOP, age | Board/module, UART pins/levels, antenna and fix quality |
| MPU-6050 IMU | Acceleration, angular rate, derived tilt | Exact board, I²C address, orientation/calibration |
| QMC5883L magnetometer | Heading and calibration/quality | Exact module and motor/chassis interference |
| Wheel encoders | Counts and estimated left/right speed | Resolution, supply, signal conditioning and direction |
| DHT22 | Temperature/humidity | Presence, GPIO, supply and update period |
| Battery voltage/current | Electrical telemetry/alerts | Sensor/divider/driver output, calibration and safe limits |
| LiDAR | Distance/status only if installed | Optional in the historical plan; model/interface/power unknown |
| ESP32-CAM / OV2640 | Capture status/image id | Board revision, power demand, interface and storage variant |

A missing, stale, invalid, or uncalibrated reading must be reported as such. GPS is informational in Phase 1. The LiDAR, camera, IMU, and GPS do not provide an autonomous or certified obstacle-safety function in this baseline.

## Historical motor/power candidate — not approved wiring

Earlier materials list four nominal 12 V DC motors and two BTS7960-style H-bridges, with one driver per side and two motors per driver shown as a candidate. That arrangement is **not confirmed**. Do not parallel motors or apply battery power until the actual driver ratings/cooling, motor startup/stall current, battery/BMS, wire gauge, connectors, fuse, regulator, and stop path have been checked.

The exact battery pack, BMS, fuse, switch, regulator, motor-driver revision, and emergency-stop circuit remain to be confirmed. Never drive a motor directly from an ESP32 GPIO. A phone STOP is not a hardware cut-off.

## Later extension — separate design review required

A second ESP32 may be considered after Phase 1 acceptance to support intelligent navigation or the future embedded-security project. That extension needs a new controller-authority/failure analysis, inter-ESP link and timeout, sensor/perception validation, privacy and threat model, and test plan. Do not wire or rely on the second controller as part of Phase 1.

## Power-up checklist

1. Read datasheets and label each actual component/revision.
2. Fill the [wiring/power map](wiring-schematic.md); verify polarity, common ground, logic levels, current, wiring, fuses and motor-driver thermal limits.
3. Bring up logic only; confirm motors are inactive at boot/reset.
4. Test the independent physical motor stop with wheels lifted and a controlled supply.
5. Verify sensor output and calibration before presenting it as real telemetry.
6. Conduct low-speed ground tests only in a clear controlled area with a spotter and cut-off available.
