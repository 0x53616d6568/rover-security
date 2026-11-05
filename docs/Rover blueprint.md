# Rover blueprint

This is a **block-level system and wiring guide**, not a pin-by-pin electrical schematic. It maps the components identified in the supplied files and marks unknown or inferred connections. Confirm every board revision, voltage, pin, connector, and current rating before wiring.

## Signal and controller connections

![Controller and signal-connection blueprint](https://private-us-east-1.manuscdn.com/sessionFile/lLfuiwSQglvcs1TqXtuxjt/sandbox/pSUUobO8rjKmygduxwOUcf-images_1793892318635_na1fn_L2hvbWUvdWJ1bnR1L2VuaXNvbGFyLXJvdmVyLXNlY3VyaXR5L2RvY3MvYmx1ZXByaW50.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbExmdWl3U1FnbHZjczFUcVh0dXhqdC9zYW5kYm94L3BTVVVvYk84cmpLbXlnZHV4d09VY2YtaW1hZ2VzXzE3OTM4OTIzMTg2MzVfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyVnVhWE52YkdGeUxYSnZkbVZ5TFhObFkzVnlhWFI1TDJSdlkzTXZZbXgxWlhCeWFXNTAucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk2MDgzMjAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEQCID0n2O1X30uKejFvFLuwr1f4XX1mekqe5uzJoTx-J8O6AiBlsFP44wL62lvuQCiiwucUpe0Ube9V0~7JoTrGJU5~JQ__)

The source architecture shows a Master ESP32-WROOM connected to the NEO-6M GPS over UART1, the drive ESP32-WROOM over UART2 (115200 8N1 is stated in the material and still needs confirmation), and an ESP32-CAM over a UART connection. A phone controls through BLE, the master talks to the optional HiveMQ/PHP service over Wi-Fi/MQTT/TLS, the DHT22 and SD adapter connect to the master, and the IMU/magnetometer connects to the drive controller. Exact pins, levels, and buses are unspecified. The LiDAR is shown as an optional array; its model and interface are unknown.

## Power and motor connections

![Provisional power and drive wiring](https://private-us-east-1.manuscdn.com/sessionFile/lLfuiwSQglvcs1TqXtuxjt/sandbox/pSUUobO8rjKmygduxwOUcf-images_1793892318635_na1fn_L2hvbWUvdWJ1bnR1L2VuaXNvbGFyLXJvdmVyLXNlY3VyaXR5L2RvY3MvcG93ZXItd2lyaW5n.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvbExmdWl3U1FnbHZjczFUcVh0dXhqdC9zYW5kYm94L3BTVVVvYk84cmpLbXlnZHV4d09VY2YtaW1hZ2VzXzE3OTM4OTIzMTg2MzVfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyVnVhWE52YkdGeUxYSnZkbVZ5TFhObFkzVnlhWFI1TDJSdlkzTXZjRzkzWlhJdGQybHlhVzVuLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5NjA4MzIwMH19fV19&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEQCIG46zK6a1jdkGt-8bAy8p2hsqqMMYYWV~ALO1aOhy2c4AiBrqHVKuh27aXU3BZTZ3dqm7WP3EH6X-bQwEp1~wIeyDQ__)

The source lists four 12 V DC motors and two BTS7960 H-bridges. The diagram shows a **candidate** layout with one H-bridge per side and two motors per driver. This is only valid if each driver, wiring, connector, battery, and protection path can handle the combined startup/stall current. That rating is not available in the supplied files. Do not wire motors in parallel until the component datasheets and measured/known stall current are checked.

The actual battery pack, BMS model, fuse rating, switch, regulator, and E-stop circuit are not specified. A suitable battery protection/fuse/switch and regulated controller supply may be required, but the exact parts and ratings must be selected from the actual components. A physical stop must interrupt motor authority through an approved hardware path; do not assume a software STOP is a physical E-stop.

## Component status

| Item | What the files establish | Still to confirm |
|---|---|---|
| Master / drive controllers | Two ESP32-WROOM controllers are depicted | Board revisions, pinout, supply range, firmware framework, security configuration |
| Camera | ESP32-CAM with OV2640 is shown | Power, UART protocol/pins, whether needed for the class demo |
| Drive | Four 12 V motors and two BTS7960 H-bridges are listed | Motor stall current, driver rating/cooling, exact left/right grouping, battery and wiring gauge |
| GPS | NEO-6M, UART1 to master is described | Pin numbers, voltage levels, antenna, fix quality and demo suitability |
| IMU | IMU plus magnetometer on drive controller is depicted | Exact model, bus, voltage, calibration and orientation |
| DHT22 / SD | DHT22 and SD adapter appear in the source architecture | Actual availability, pin mapping, voltage and whether required for the demo |
| Battery / BMS / LiDAR | BMS and LiDAR are pictured; battery pack is not specified | Exact model, ratings, wiring, sensor interface and whether fitted at all |
| E-stop | A physical-stop concept is recommended in project safety docs | Whether a physical device exists and the exact hardware disable circuit |

## Before connecting power

1. Identify each actual board/module and use its datasheet, not the image, for voltage and pin details.
2. Record the battery chemistry, nominal/max voltage, continuous current, and protection. Confirm motor stall current against the driver and battery limits.
3. Check common ground, polarity, wire gauge, connector rating, fuse/protection, and motor-driver cooling.
4. Keep motor enable off during logic bring-up. Verify the physical motor disable before powered movement.
5. Lift the wheels for initial tests, use low speed and a spotter, and stop if anything heats or moves unexpectedly.

Fill the actual pin map and component inventory in [`wiring-schematic.md`](wiring-schematic.md). Replace every “TBD” only after checking the real hardware.
