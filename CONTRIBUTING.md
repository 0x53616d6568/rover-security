# Team workflow

This repository is the planning baseline for the ENISOLAR Phase 1 rover demonstration. Keep tasks small, integrate daily, and prioritize a safe working manual-control demonstration over extra features. Follow the person-by-person checklist in the root README and the focused docs under `docs/`.

Phase 1 means one main ESP32, an auxiliary ESP32-CAM, phone control over local BLE, and dashboard telemetry from sensors actually fitted and validated. It does not include autonomous routes, waypoints, cloud/MQTT control, or the second ESP32. Record later intelligent-navigation and embedded-security work as deferred extensions requiring their own review.

Before powering motors, check actual wiring and ratings, test with wheels lifted, and verify the physical stop independently. Do not expose the rover to the public internet or commit secrets. Document actual hardware, measured results, firmware/build version, and tests performed. Mark unimplemented, simulated, or unverified features honestly; never treat a plan or example value as an achieved result.
