# Dashboard

## Goal

A simple local page or app to demonstrate connection status, current mode, basic drive controls, and an always-visible stop action. Prioritize readability and reliable stop behavior over styling.

## Minimum screen

- Connection state: connected / disconnected.
- Mode: manual / demo navigation / stopped / fault.
- Controls: forward, reverse, left, right, stop.
- Optional speed slider with a strict maximum set by the firmware owner.
- Status message for the last command or fault.

## Tasks

- [ ] Day 1: sketch the screen and select the easiest supported local client.
- [ ] Day 2: implement the stop button and visible connection state first.
- [ ] Day 3: add allowed drive controls and status display.
- [ ] Day 4: test on the actual phone/laptop; confirm disconnected state disables motion controls.
- [ ] Day 5: rehearse the demo from a fresh connection and record any limitation.

## Acceptance

A user can tell whether the rover is connected and stopped, issue only the supported commands, and find the stop button immediately. The dashboard must not display secrets or imply that a command succeeded when no acknowledgement/status was received.
