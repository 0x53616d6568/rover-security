# BLE Unauthenticated Discovery and GATT Enumeration Test

**Purpose:** assess whether the project-owned rover advertises its BLE presence, accepts a GATT connection before pairing, exposes its service/characteristic layout, or permits a characteristic read without authentication.

**Status:** procedure only. The test has not been executed and no result is claimed.

**Scope:** the ENISOLAR rover and a Kali Linux test laptop in the team's lab. This first pass is deliberately read-only: it does not pair, write a command, brute-force a passkey, jam BLE, or attempt to connect to other devices. Disconnect motor power before testing so an accidental later test cannot move the rover.

## What this test establishes

The test has four separate observations:

1. **Advertisement discovery:** Kali can hear the rover's BLE advertisement and record the advertised name and address.
2. **GATT connection:** Kali can open a BLE connection without first pairing.
3. **GATT enumeration:** Kali can list services and characteristics discovered from the connected device, without supplying UUIDs from the repository.
4. **Read authorization:** Kali can or cannot read characteristics that advertise the `read` property while unpaired.

Discovery or a successful GATT connection alone is not proof that command access is possible. A characteristic advertising `write` is not proof that an unauthenticated write will be accepted. This guide sends no writes.

## Source baseline to compare after discovery

The checked-in source names the rover `ENISOLAR-ROVER`. It declares the BLE service UUID as `8f4d0001-4f4b-4e49-9e4f-454e49534f01`, command characteristic as `8f4d0002-4f4b-4e49-9e4f-454e49534f01`, and status characteristic as `8f4d0003-4f4b-4e49-9e4f-454e49534f01`. These are comparison values only: **the discovery procedure below does not use them to find or enumerate the service**. See [`board_config.h`](https://github.com/0x53616d6568/rover-security/blob/da13547bd0ca5f64191ba233855ef71537cecae3/firmware/include/board_config.h) and [`ble_control.cpp`](https://github.com/0x53616d6568/rover-security/blob/da13547bd0ca5f64191ba233855ef71537cecae3/firmware/src/ble_control.cpp).

The same source sets the passkey to `123456` and treats an empty or all-zero authorized-central address as “allow any central” at the firmware authorization layer. Confirm the configuration and firmware actually flashed to the rover; a repository setting alone does not prove the deployed behavior. The firmware also configures BLE security, so an advertised service or a connection attempt must not be mistaken for a pairing bypass.

## Prerequisites

- The project-owned rover, powered so the ESP32 is running and advertising.
- Motor-driver power disconnected for this read-only discovery test.
- Kali Linux with a working Bluetooth Low Energy adapter.
- USB serial access to the ESP32 is recommended to correlate connection and authorization logs.
- Do not use Kali credentials or pair the Kali laptop before the unpaired baseline is recorded.

On the rover, monitor the ESP32 serial output at 115200 baud if PlatformIO is available:

```bash
pio device monitor -b 115200
```

Alternatively, identify the serial device and use a serial terminal such as `picocom`:

```bash
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
sudo apt install -y picocom
picocom -b 115200 /dev/ttyUSB0
```

Replace `/dev/ttyUSB0` with the actual port. Record whether the startup log says `OPEN (any)` or `RESTRICTED` and whether it reports advertising started. Do not publish a full device MAC address or telemetry that may contain private data in a public report.

## Step 1 — Prepare Kali without pairing

Install BlueZ and Python support, start Bluetooth, and unblock the adapter:

```bash
sudo apt update
sudo apt install -y bluez python3-venv
sudo systemctl enable --now bluetooth
sudo rfkill unblock bluetooth
bluetoothctl list
```

`bluetoothctl list` should show a local adapter. If it does not, resolve the adapter/driver issue before interpreting a failed scan as a rover security result.

Open the Bluetooth control tool:

```bash
bluetoothctl
```

At its prompt, power on the adapter and start a low-energy scan:

```text
power on
scan le
```

If this BlueZ version does not accept `scan le`, use `scan on`. Wait up to 30 seconds for `ENISOLAR-ROVER`. Record its advertised name, address, and RSSI, then stop scanning:

```text
scan off
quit
```

**What this step does:** it passively listens for BLE advertisements. The advertised address may be a private/randomized address and may change; if the address changes, repeat discovery and use the current scan result. Hearing an advertisement means the device is discoverable nearby, not that the GATT service is unauthenticated.

If Kali has a saved bond from an earlier test, remove that bond before the unpaired run. Replace the address with the value found during scanning:

```bash
bluetoothctl remove XX:XX:XX:XX:XX:XX
```

Confirm with `bluetoothctl info XX:XX:XX:XX:XX:XX` that Kali does not list it as paired. Do not run `pair` for this phase. If the operating system offers to pair during the connection attempt, cancel and record the prompt rather than entering a passkey.

## Step 2 — Install the BLE inspection library

Create a dedicated Python virtual environment and install Bleak, which uses the system Bluetooth stack on Linux:

```bash
python3 -m venv ~/venvs/rover-ble
source ~/venvs/rover-ble/bin/activate
python -m pip install --upgrade pip bleak
```

This avoids installing the Python package globally. If scanning later fails, first check that BlueZ is running and the adapter is visible; do not infer a rover-side security result from a Kali setup failure.

## Step 3 — Discover the device and enumerate GATT dynamically

Save the following as `ble_discover.py`. It finds the target by its advertised name. It does not contain any service or characteristic UUIDs from the repository. After connecting, Bleak asks the connected device for its GATT database and the script prints the UUIDs and advertised properties it discovers. It attempts reads only for characteristics that advertise `read`; it never writes.

```python
import asyncio
from bleak import BleakScanner, BleakClient

TARGET_NAME = "ENISOLAR-ROVER"

async def main():
    found = await BleakScanner.discover(timeout=15, return_adv=True)
    matches = []

    for address, (device, adv) in found.items():
        name = adv.local_name or device.name or ""
        if TARGET_NAME.casefold() in name.casefold():
            matches.append((address, device, adv, name))

    if not matches:
        print(f"No advertisement matching {TARGET_NAME!r} was found.")
        print("Nearby BLE advertisements:")
        for address, (device, adv) in found.items():
            print(
                f"  address={address} "
                f"name={adv.local_name or device.name or '<unnamed>'!r} "
                f"services={adv.service_uuids or []}"
            )
        return

    for index, (address, _device, adv, name) in enumerate(matches, start=1):
        print(f"Match {index}: name={name!r} address={address}")
        print(f"  RSSI: {adv.rssi} dBm")
        print(f"  Advertised services: {adv.service_uuids or []}")

    address, device, _adv, _name = matches[0]
    print(f"\nAttempting an unpaired GATT connection to {address}...")
    print("If a pairing/passkey prompt appears, cancel it and record the result.")

    try:
        async with BleakClient(device, timeout=15) as client:
            print("GATT connected:", client.is_connected)
            print("\nDiscovered GATT database:")

            for service in client.services:
                print(f"\nSERVICE uuid={service.uuid} handle={service.handle}")
                for char in service.characteristics:
                    print(
                        f"  CHARACTERISTIC uuid={char.uuid} "
                        f"handle={char.handle} properties={char.properties}"
                    )

                    for descriptor in char.descriptors:
                        print(
                            f"    DESCRIPTOR uuid={descriptor.uuid} "
                            f"handle={descriptor.handle}"
                        )

                    if "read" in char.properties:
                        try:
                            value = await client.read_gatt_char(char.uuid)
                            print(f"    READ allowed; bytes={value!r}")
                        except Exception as exc:
                            print(f"    READ denied/failed: {type(exc).__name__}: {exc}")

    except Exception as exc:
        print(f"GATT connection/enumeration failed: {type(exc).__name__}: {exc}")

asyncio.run(main())
```

Run the script:

```bash
source ~/venvs/rover-ble/bin/activate
python ble_discover.py
```

**What this step does:** it performs active connection and GATT discovery after passive scanning. A read that succeeds without pairing is a candidate unauthorized-read finding only if that characteristic was intended to be protected. A read that returns an authentication/authorization error is evidence that the tested read was blocked. A connection failure may be caused by radio range, a stale/random address, adapter issues, or security policy; capture the exact error and serial log before drawing a conclusion.

## Step 4 — Compare discovery with the source, after the blind test

Only after saving the discovery output, compare it with the checked-in values:

- Service: `8f4d0001-4f4b-4e49-9e4f-454e49534f01`
- Command: `8f4d0002-4f4b-4e49-9e4f-454e49534f01`
- Status: `8f4d0003-4f4b-4e49-9e4f-454e49534f01`

This comparison checks whether the live device resembles the repository configuration. It does not turn the UUIDs into discovery inputs. Record differences; firmware builds and deployed hardware may not match the current source.

Do not write to the command characteristic in this guide. If a later test needs to check whether unauthenticated command writes are accepted, plan it as a separate test with the exact flashed firmware identified and motor power physically disconnected. A GATT characteristic showing `write` or `write-without-response` is only a declared property; it does not prove an unauthenticated write is accepted by the application.

## Record the result

Use a row like this in the test log:

| Field | Result |
|---|---|
| Test date and time | |
| Rover firmware/build identifier | |
| Rover advertised name | |
| Address found by Kali | Redact in any public copy |
| Advertisement found | Yes / No |
| GATT connection before pairing | Success / Denied / Error |
| Pairing prompt appeared | Yes / No |
| Discovered service and characteristic UUIDs | |
| Status/readable characteristic read before pairing | Allowed / Denied / Not attempted |
| ESP32 serial log result | |
| Kali adapter and BlueZ/Bleak versions | |
| Notes and evidence file names | |

A complete result distinguishes the four outcomes: **advertised**, **connected**, **enumerated**, and **readable**. Do not describe a UUID being visible or a successful connection as a command-control compromise.

## Taxonomy references

Use taxonomy IDs only when the test outcome supports them:

- [CWE-287: Improper Authentication](https://cwe.mitre.org/data/definitions/287.html) — relevant if an authentication requirement can actually be bypassed.
- [CWE-862: Missing Authorization](https://cwe.mitre.org/data/definitions/862.html) — relevant if a GATT operation succeeds without the authorization the project requires.
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html) — relevant to the fixed passkey in source; it is a separate source-level issue from proving unauthenticated access.
- [OWASP IoT Top 10 2018, I1: Weak, Guessable, or Hardcoded Passwords and I9: Insecure Default Settings](https://owasp.org/www-pdf-archive/OWASP-IoT-Top-10-2018-final.pdf) — I1 relates to the fixed passkey; I9 applies if the all-zero allow-any setting is deployed as the default.

These are CWE/OWASP classifications and guidance, not CVEs. No CVE is assigned by this procedure. A CVE would require an exact affected product and version with a matching published advisory.
