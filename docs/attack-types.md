# Attack type registry

This index keeps the security exercises separate from the Phase 1 functional documentation. Each entry records the access required, the asset at risk, and the document with the procedure or analysis. An entry is a scope definition, not a claim that every listed outcome was achieved.

| ID | Attack type | Access required | Primary asset | Status | Detail |
|---|---|---|---|---|---|
| AT-01 | Unauthorized BLE discovery and GATT enumeration | Nearby BLE radio; no pairing for the read-only baseline | Device presence, service layout, readable status characteristics | Procedure only; no result claimed in the repo | [BLE discovery and GATT enumeration](../manual%20mode%20firmware%20security/ble-unauthenticated-discovery-and-gatt-enumeration.md) |
| AT-02 | Illogical / destructive MQTT command injection | Ability to publish to `rover/1/command` | Command integrity and physical hardware | Design analysis and defensive spec | [AI-powered broker and illogical command defense](ai-powered-broker-and-illogical-command-defense.md) |
| AT-03 | ESP32 flash extraction and NVS credential recovery | Authorized physical/serial access or an existing dump | Wi-Fi credentials, MQTT credentials, BLE identifiers, endpoints | Local workbench and reports exist; raw values intentionally not reproduced | [Flash extraction attack type](../attacks/esp32-firmware-extraction/README.md) |

## How to use this registry

- Read the linked document before running a test. Several procedures require motor power disconnected and a spotter.
- Keep raw evidence outside git. Dumps, NVS reports, and unredacted string reports may contain real credentials.
- Record only sanitized metadata in repository docs: firmware identifier, tool versions, artifact sizes, partition map, finding categories, and remediation status.
- Do not convert a source-level observation into a runtime claim without a test on the exact flashed build.
- After a credential-recovery exercise, rotate exposed Wi-Fi and broker credentials; deleting an NVS key is not rotation.

## Related safety constraints

The project safety rules still apply to every attack exercise: bounded commands, 500 ms command timeout target, explicit arm/STOP, no auto-resume, and a physical motor stop independent of BLE, MQTT, firmware, and the dashboard. See [security and safety checklist](security.md) and [MQTT split architecture](mqtt-architecture.md).
