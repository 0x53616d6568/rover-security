# Navigation scope

## Phase 1: operator-guided only

Phase 1 has **no autonomous navigation**. The rover is guided manually from the phone over BLE using bounded forward/reverse and turn commands. GPS, IMU, compass, camera, and optional LiDAR data may be displayed as telemetry if fitted and validated, but they do not create a route or trigger movement.

Out of scope: timed paths, waypoint routes, patrols, AUTO mode, return-to-base, object/person classification, obstacle avoidance, and safety decisions made autonomously. The five-day demo must not add a timed/waypoint route as a fallback feature.

## Later intelligent extension gate

After Phase 1 acceptance, a separately reviewed extension may consider the second ESP32, sensor interfaces, navigation/perception, and the embedded-security project. Before implementation, define:

- which controller owns motor authority and what happens if either ESP32 or their link fails;
- confirmed sensor models, field of view/range, update rates, calibration, and limits;
- bounded test area, speed, operator override, physical stop, and measurable fail-safe behavior;
- data handling, threat model, privacy, and claims that can be validated.

The LiDAR shown as optional in the historical blueprint is not assumed to be installed. No future safety or obstacle-detection capability is implied by this planning note.
