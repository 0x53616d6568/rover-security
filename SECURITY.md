# Security and safety

This repository describes a supervised classroom prototype, not a production rover, safety certification, or complete security implementation. Phase 1 uses a phone-to-rover local BLE control link and must be operated only in a controlled demonstration area.

Do not expose the control interface to the public internet. Do not commit passwords, tokens, private keys, or personal data. Confirm component ratings and the physical motor cut-off before powered movement. Use low speed, wheels-lifted initial tests, an operator in view, and a spotter. Stop if the rover behaves unexpectedly or any stop mechanism fails.

See [the Phase 1 security checklist](docs/security.md), [wiring/bring-up checklist](docs/wiring-schematic.md), and the [v1.2 requirements PDF](docs/Cahier_des_charges_Rover_ENISOLAR_v1.2.pdf). BLE pairing or a phone STOP alone is not proof of production security or a physical stop.
