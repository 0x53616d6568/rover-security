# Wiring schematic — Phase 1

> This is a block-level guide. Fill the pin map from the actual parts on the bench. Do not assume slide diagrams match the hardware. Verify voltage/current ratings and motor stall current before connecting battery or motors.

## Block diagram

```text
Phone dashboard ── local BLE ── Main ESP32 (only Phase 1 motion authority)
                                     ├── verified driver inputs → left/right motors
                                     ├── fitted sensors → telemetry / optional SD logging
                                     └── auxiliary command/status interface (TBD)
                                                └── ESP32-CAM / OV2640 (capture only)

Battery → fuse/protection + switch ──┬── motor driver(s) ── motors
                                     └── rated regulator(s) ── ESP32 / sensors / camera as specified

Physical stop ── independently verified motor power/enable interruption path
```

Do not treat the block diagram as a schematic or a completed stop design. Establish the physical stop architecture with the actual driver and power components.

## Pin and power map — fill from actual hardware

| Function | Board pin / connector | Component pin | Voltage / notes | Checked |
|---|---|---|---|---|
| Main ESP32 logic power / ground | TBD | TBD | Verify board input and regulator capacity | [ ] |
| Left/right motor driver control | TBD | TBD | Exact driver, PWM/enable logic and thermal rating | [ ] |
| Motor supply / fuse / switch | TBD | TBD | Battery voltage/current, fuse and wire rating TBD | [ ] |
| Physical stop / driver disable | TBD | TBD | Must work independently of phone/BLE; test before driving | [ ] |
| GPS NEO-6M UART | TBD | TBD | Confirm voltage levels, UART pins and antenna | [ ] |
| IMU / QMC5883L I²C | TBD | TBD | Confirm shared bus/address, voltage and calibration | [ ] |
| Wheel encoders | TBD | TBD | Confirm signal level, conditioning, resolution and interrupts | [ ] |
| DHT22 | TBD | TBD | Confirm fitted module and supply | [ ] |
| Battery voltage/current sensing | TBD | TBD | Only if instrumented; calibrate/protect ADC or sensor | [ ] |
| Optional LiDAR | TBD | TBD | Include only after exact module/interface confirmed | [ ] |
| ESP32-CAM link and supply | TBD | TBD | UART/power TBD; verify peak camera current; no motor authority | [ ] |
| SD/storage | TBD | TBD | Identify which board/module owns storage and voltage | [ ] |

No pins or electrical ratings are approved by this document. Verify boot-strapping/flash pins and UART conflicts before assigning pins. Keep camera/logging work from blocking drive-control tasks.

## Bring-up checklist

- [ ] Identify every board/module revision; obtain datasheets and ratings.
- [ ] Check polarity, common ground, wire gauge, connectors, fuse/protection, supply capacity, driver cooling, and motor startup/stall current.
- [ ] Bring up controller logic with motors disconnected; verify outputs are inactive at boot/reset.
- [ ] Test the physical stop/disable path independently of phone STOP and firmware commands.
- [ ] Test sensors one by one; record valid readings, units, calibration, and age.
- [ ] Lift wheels for initial motor tests; use low speed, a controlled current-limited supply where appropriate, and keep the physical cut-off accessible.
- [ ] Record actual wiring revision, pin map, component references, and successful tests.

Stop immediately if anything heats unexpectedly, the motors start at boot, or the physical stop fails. Never guess a pinout, connect a motor to a GPIO, or parallel motors on a driver without a ratings/current review.
