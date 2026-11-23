# Attack type: ESP32 flash extraction and NVS credential recovery

**Classification:** credential access / physical or debug-interface access; follow-on enabler for command-plane compromise.
**Sanitized tool copy:** [`workbench/`](workbench/README.md), derived from the local `D:\rover_firmware_workbench` folder.
**Status:** the local workbench and local reports exist. No extracted credential values are reproduced in this repository. This is not a claim about production systems or deployed firmware beyond the project-owned case.

## What this attack type is

This attack type covers **read-only recovery of secrets from an ESP32 firmware image**. The workbench in this folder:

1. Enumerates serial ports and queries the ESP32 flash ID with `esptool`.
2. Reads the full flash to a local binary evidence file.
3. Slices the dump into the known 4 MiB rover partition layout.
4. Decodes NVS with Espressif's `nvs_tool.py`, including erased entries.
5. Scans application strings for MQTT hosts, topics, BLE UUIDs, endpoints, and credential-bearing strings.
6. Can reconstruct a partial ELF from an application image when a compatible parser is configured.

The workbench does **not** erase, flash, modify, or connect to the MQTT broker. It is a local forensic/credential-recovery aid, but its reports are explicitly unredacted.

## Why it matters for this rover

The current design creates exactly the kind of material this attack recovers:

- The BLE WiFi initialization frame `WIFI,<ssid>,<password>` is persisted in ESP32 NVS (`Preferences` namespace `rover_wifi`). NVS can retain deleted/overwritten values, so credential rotation must not rely on “deleting” an old entry.
- MQTT broker hostnames, usernames, passwords, topics, and BLE constants can be compiled into the application image as plain strings.
- Anyone who recovers those values can subscribe/publish with the original role, inject bounded drive commands on the command broker, impersonate telemetry, or re-point WiFi to an attacker-controlled network.

Recovering a credential is a confidentiality failure. Using it to move the rover is a separate integrity/safety failure that depends on broker authorization, firmware acceptance, and the physical state of the rover.

## Scope and safety

- Use **only** on hardware and firmware the team owns or is explicitly authorized to assess.
- Disconnect motor power before connecting serial tooling. A flash read is non-destructive, but a bench accident or later command test must not be able to move the rover.
- This repo copy contains **source and tools only**. It deliberately excludes dumps, extracted partitions, decoded NVS reports, string reports, `config.json`, and case directories.
- Do not paste recovered SSIDs, passwords, broker credentials, private keys, certificates, full device addresses, or raw report lines into issues, commits, chat, screenshots, or test logs.
- Static strings do not prove runtime behavior. Confirm broker roles, TLS settings, topic handling, and credential use by tracing code references and observing authorized runtime traffic.

## Local evidence inventory — metadata only

The external workbench at `D:\rover_firmware_workbench` contains local evidence. The values below are file sizes and partition metadata only; no recovered strings are included.

| Local artifact | Metadata |
|---|---|
| Full flash dump | `evidence/esp32_full_flash.bin`, 4,194,304 bytes (4 MiB) |
| Extracted partitions | `nvs`, `otadata`, `app0`, `app1`, `spiffs`, `coredump` |
| Local string report | 676 candidate strings; categories: `wifi/nvs` 162, `ble` 177, `other` 152, `credential` 90, `endpoint` 63, `mqtt/topic` 32 |

Known 4 MiB partition map used by the workbench (verify against the actual partition table before reusing on another build):

| Partition | Offset | Size |
|---|---:|---:|
| `nvs` | `0x9000` | `0x5000` |
| `otadata` | `0xE000` | `0x2000` |
| `app0` | `0x10000` | `0x140000` |
| `app1` | `0x150000` | `0x140000` |
| `spiffs` | `0x290000` | `0x160000` |
| `coredump` | `0x3F0000` | `0x10000` |

The report counts describe that local case only. They are not a universal result for every firmware build.

## Workflow implemented by the workbench

1. **Device and flash:** select the ESP32 COM port, confirm chip/flash ID, set 4 MiB (`0x400000`), and read flash to `evidence/esp32_full_flash.bin`.
2. **Tools:** use the bundled NVS decoder and ESP32 image parser, or explicitly configured external tools. Parser arguments must be verified with `--help` before use.
3. **Extract partitions:** slice the dump using the known map and write `reports/partition_manifest.json`.
4. **Decode NVS:** run `nvs_tool.py` with dump mode `all` or `blobs` to recover written, erased, and empty entries. This is where real Wi-Fi SSID/password values are expected.
5. **Scan strings:** scan `app0.bin` for candidate strings and `nvs.bin` for all printable strings. Results are grouped by category and written to `reports/app0_candidates.txt` and `reports/strings_report.json`.
6. **Search and inspect:** run substring/regex searches over extracted partitions and dump printable strings around selected offsets.
7. **Reconstruct ELF (optional):** attempt partial symbol recovery from `app0.bin`; success is toolchain-specific.
8. **Rotate:** treat every recovered credential as exposed. Rotate Wi-Fi and broker credentials and redeploy firmware; deleting an NVS entry is not rotation.

## Sanitized findings

- `app0.bin` is expected to contain application constants: MQTT host/topic strings, BLE names/UUIDs, and credential-related literals or format strings. These are compiled into the image.
- `nvs.bin` is expected to contain real Wi-Fi configuration values, including erased entries that a normal `written`-only view can miss.
- `otadata` is extracted but not interpreted by default; active OTA slot must be verified before trusting `app0`.
- `spiffs` and `coredump` are preserved for completeness and may contain additional sensitive data depending on the application.

No raw values from these artifacts are included here.

## Impact

| Aspect | Assessment |
|---|---|
| Confidentiality | High: Wi-Fi, broker, certificate, or key material may be recovered from a readable image. |
| Integrity | Follow-on: recovered command-broker credentials allow `CMD` publication if accepted by firmware. |
| Availability | Follow-on: recovered WiFi credentials allow network disruption or rogue-AP redirection. |
| Safety | Not established by extraction alone. Physical motion depends on separate authorization, arming, and motor paths. |

## Mitigations

- Restrict physical and USB/UART access to project hardware; assume anyone with serial bootrom access can read flash unless hardware protections are configured.
- Enable secure boot and flash encryption on production hardware, with keys provisioned and managed outside firmware source. Test recovery procedures before locking devices.
- Do not hard-code long-lived Wi-Fi or MQTT credentials in firmware. Provision per-device credentials securely at first boot or use a managed secrets service/secure element where appropriate.
- Treat `WIFI` and `SHIFT_BROKER`-style frames as privileged control frames. Require authenticated, authorized sources; currently they are only as trustworthy as the BLE/MQTT command path that carries them.
- Stop logging full command/credential payloads to serial or dashboards; log metadata and reasons instead.
- Rotate credentials found in extracted images. The credentials are in the image even if the image is later deleted.
- Verify TLS identity on MQTT links and use broker ACLs with separate telemetry and command roles so a recovered telemetry credential cannot drive.
- Keep debug interfaces and case directories out of public artifacts. Add local evidence folders to ignore rules, not to release bundles.

## Evidence handling rules

- Keep raw dumps and reports in controlled local storage only.
- Do not commit `*.bin`, `nvs_decoded.txt`, `app0_candidates.txt`, `strings_report.json`, `config.json`, or any `*_case/` directory.
- Record only metadata in public docs: firmware/build identifier, dump size, partition manifest, report counts, and remediation status.
- If a report must be shared, redact every credential value first and confirm with a second reviewer.
- Rotate any credential that was ever present in an unredacted report.

## Taxonomy

Use these classifications only to the extent the local evidence supports them:

- [CWE-312: Cleartext Storage of Sensitive Information](https://cwe.mitre.org/data/definitions/312.html) — credentials stored recoverably in flash/NVS.
- [CWE-522: Insufficiently Protected Credentials](https://cwe.mitre.org/data/definitions/522.html) — credentials not protected against local recovery.
- [CWE-798: Use of Hard-coded Credentials](https://cwe.mitre.org/data/definitions/798.html) — broker credentials compiled into the application image.
- [OWASP IoT Top 10 2018, I1 / I7 / I9](https://owasp.org/www-pdf-archive/OWASP-IoT-Top-10-2018-final.pdf) — hardcoded/weak credentials, insecure data storage, and insecure defaults where applicable.

These are classifications and guidance, not CVEs. No CVE is assigned by this document.

## Verification checklist

- [ ] Exact firmware/build identifier recorded for the extracted image.
- [ ] Dump size and partition manifest recorded; layout verified against the real partition table.
- [ ] NVS decoded with `all`/`blobs`; credential-bearing namespaces identified without copying values into public docs.
- [ ] Application strings reviewed for broker endpoints, topics, and credential literals.
- [ ] All recovered Wi-Fi and broker credentials rotated and old values invalidated.
- [ ] Raw dumps/reports confirmed outside git and excluded from release artifacts.
- [ ] Follow-on command injection test planned separately with motor power disconnected.

## Related attack types

- [BLE unauthorized discovery and GATT enumeration](../../manual%20mode%20firmware%20security/ble-unauthenticated-discovery-and-gatt-enumeration.md)
- [AI-powered broker and illogical command defense](../../docs/ai-powered-broker-and-illogical-command-defense.md)
- [Attack type registry](../../docs/attack-types.md)
