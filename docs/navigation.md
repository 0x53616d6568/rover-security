# Navigation

## Demo scope

Keep navigation intentionally simple. First deliver manual low-speed control. Add one repeatable navigation behavior only if the required sensors and safety checks are available. In one week, a short timed route or a simple waypoint sequence is more realistic than robust autonomous navigation.

## Demo option A — Timed path

Drive forward for a short measured interval, stop, turn for a short interval, then stop. Test with wheels lifted first and then in a clear, bounded area at low speed. Timed motion is open-loop and will drift with battery level, surface, and motor differences; present it as a demonstration, not accurate navigation.

## Demo option B — Simple waypoint sequence

Use only if GPS or equivalent localization is working and the team can define a safe boundary. Limit the route to a small area, low speed, a short number of waypoints, and a manual stop. If the position is unavailable or implausible, stop rather than continue blindly.

## Tasks

- [ ] Choose and document the demo option on Day 1.
- [ ] Define the test area, speed limit, manual override, and stop condition.
- [ ] Add basic state/mode display: `MANUAL`, `DEMO`, `STOPPED`, or `FAULT`.
- [ ] Test start, stop, disconnect, and sensor-loss behavior.
- [ ] Rehearse the same route at least three times; record failures and limits.

## Acceptance

The navigation demonstration starts only on an explicit action, stays within the agreed demo area, and can be stopped immediately. It must fail safe on loss of command or required sensor. Do not claim obstacle avoidance, GPS spoofing resistance, or robust autonomous navigation unless those features are actually implemented and tested.
