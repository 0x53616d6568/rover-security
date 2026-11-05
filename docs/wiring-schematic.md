# Wiring schematic

> Fill this in from the actual parts on the bench. Do not assume the slide diagrams match your hardware. Confirm voltage and current ratings before connecting the battery or motors.

## Block diagram

```text
Battery / power switch
    ├── protected motor supply → motor driver → left/right motors
    └── regulated logic supply → controller board
                                  ├── motor-driver control pins
                                  ├── optional IMU / GPS / encoder
                                  └── local Wi-Fi or BLE → dashboard

Physical stop / motor-disable control → motor driver enable or power path
```

## Pin and power map

| Function | Board pin / connector | Component pin | Voltage / notes | Checked |
|---|---|---|---|---|
| Logic power | TBD | Controller VIN/5V/3V3 | Confirm board input range | [ ] |
| Ground | TBD | Common ground | Verify return path | [ ] |
| Left motor control | TBD | Driver input | Confirm logic level | [ ] |
| Right motor control | TBD | Driver input | Confirm logic level | [ ] |
| Motor supply | TBD | Driver VM/battery | Confirm battery and driver rating | [ ] |
| Driver enable/stop | TBD | EN/STBY/disable | Default must be motors off | [ ] |
| IMU/GPS/encoder (optional) | TBD | Sensor bus/pins | Record bus, address, voltage | [ ] |

## Bring-up checklist

- [ ] Identify every board/module and read its voltage/current limits.
- [ ] Check polarity, common ground, exposed conductors, and motor-driver wiring before power-on.
- [ ] Test controller logic power with motors disconnected.
- [ ] Verify motor enable defaults to OFF on boot/reset.
- [ ] Test the physical stop or motor-disable path before running motors.
- [ ] Lift wheels for first motor tests; use low speed and an accessible power cut-off.
- [ ] Record the actual pin map, board revision, and any changes here.

**Stop immediately** if anything heats unexpectedly, the motors start at boot, or the physical stop does not work. Never guess a pinout or connect a motor directly to a GPIO.
