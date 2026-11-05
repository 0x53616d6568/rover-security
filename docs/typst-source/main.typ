// One-week ENISOLAR rover university demo plan
#import "report-theme.typ": report-accent, report-theme
#import "@preview/glossarium:0.5.10": make-glossary, register-glossary, print-glossary
#show: report-theme.with(
  title: "ENISOLAR Rover — One-Week Demo Plan",
  author: "University Project Team",
  rhythm: "report",
  running-header: true,
)
#show: make-glossary
#let terms = (
  (key: "ble", short: "BLE", long: "Bluetooth Low Energy", description: "An optional local phone-to-rover link."),
  (key: "mvp", short: "MVP", long: "minimum viable prototype", description: "The smallest working demonstration agreed by the team."),
  (key: "firmware", short: "Firmware", long: "embedded software", description: "Software running on the rover controller."),
  (key: "estop", short: "E-stop", long: "emergency stop", description: "A physical stop or motor-disable control, where supported by the available hardware."),
  (key: "wifi", short: "Wi-Fi", long: "local wireless network", description: "The suggested local link for a simple dashboard demo."),
)
#register-glossary(terms)

#page(margin: (top: 30%, x: 2.2cm), numbering: none, header: none)[
 #set par(first-line-indent: 0em)
 #align(center)[
  #text(size: 26pt, weight: "bold", fill: report-accent)[ENISOLAR Rover — One-Week Demo Plan]
  #v(0.7em)
  #text(size: 14pt, fill: luma(80))[A simple three-person university project]
  #v(2em)
  #line(length: 40%, stroke: 0.5pt + luma(160))
  #v(2em)
  #text(size: 11pt)[From available parts to a safe, local rover demonstration]
  #v(0.5em)
  #text(size: 10pt, fill: luma(90))[Planning baseline · 5 November 2026]
  #v(2em)
  #block(width: 85%, fill: rgb("#EFF5F8"), stroke: 0.5pt + rgb("#C5D4DE"), inset: 12pt, radius: 4pt)[
   #align(left)[#strong[Goal.] Low-speed rover control from a simple local dashboard, a visible status display, and one repeatable navigation demonstration if hardware allows. #strong[Limit.] This is a class prototype, not a secure production rover or a certification.]
  ]
 ]
]
#page(numbering: none, header: none)[#outline(title: [Contents], indent: 1.5em)]
#counter(page).update(1)

= One-week scope

Start from the parts the team can obtain immediately. Use standard development hardware and an existing chassis if available; avoid custom PCB, new cloud services, machine-learning detection, OTA, and advanced autonomy this week. If the physical build is blocked, use a simulator or mocked status and say so clearly.

Use one local connection only: a local Wi-Fi access point/web page is the simple default if supported; use BLE only if that path already works. Keep speed low, test stop/disconnect behavior, and do not expose control to the public internet. A short timed route or small waypoint sequence is an optional demo, not robust autonomous navigation.

#table(
 columns: (0.75fr, 1.5fr, 3.2fr, 2.2fr),
 inset: 6pt, stroke: 0.5pt + luma(190),
 fill: (x,y) => if y == 0 { rgb("#E7EEF3") } else { white },
 [#strong[Day]], [#strong[Milestone]], [#strong[Work]], [#strong[Exit check]],
 [#strong[1]], [Scope and parts], [Confirm parts, safe pin/power map, local connection, command names and demo area.], [Parts and risks known; no unreviewed wiring.],
 [#strong[2]], [Safe bring-up], [Logic power and controller first; test motor driver with wheels lifted; check physical disable.], [Boot/reset keeps motors off; stop path tested.],
 [#strong[3]], [Core features], [Bounded drive commands, dashboard status, and simple manual or timed navigation.], [Commands and stop work on real hardware or simulator.],
 [#strong[4]], [Integration], [Test invalid input, disconnect, reconnect, reboot, stop and demo flow together.], [No critical demo bug; fallback ready.],
 [#strong[5]], [Freeze and present], [Feature freeze, three run-throughs, setup guide, limitations and demo script.], [Repeatable, safe demonstration.],
)

= Person-by-person checklist

#table(
 columns: (0.95fr, 1.5fr, 4.8fr),
 inset: 6pt, stroke: 0.5pt + luma(190),
 fill: (x,y) => if y == 0 { rgb("#E7EEF3") } else { white },
 [#strong[Person]], [#strong[Owns these docs]], [#strong[Daily to-do]],
 [#strong[1]], [Wiring schematic; Firmware], [Day 1 inventory and pin/power map. Day 2 safe wiring, motor driver and disable test. Day 3 boot, bounded motor commands, status and stop-on-timeout. Day 4 integrate. Day 5 final build and recovery steps.],
 [#strong[2]], [Navigation; Connectivity], [Day 1 choose one local link and demo behavior. Day 2 agree command/status format. Day 3 manual control and a simple timed path or simulated waypoint. Day 4 disconnect/reconnect and invalid-input tests. Day 5 document connection and limits.],
 [#strong[3]], [Dashboard; Security], [Day 1 scope board and UI sketch. Day 2 stop button and connection state. Day 3 allowed controls and basic checks. Day 4 lead joint integration test. Day 5 rehearse demo and review docs/limitations.],
)

== Shared daily rule

Agree one deliverable per person each morning and integrate by the end of the day. Keep a known-good version. If parts, drivers, or connection fail on Day 1, switch early to the simulator or simpler local control rather than waiting until the final day.

= Six working docs

#table(
 columns: (1.6fr, 4.8fr),
 inset: 6pt, stroke: 0.5pt + luma(190),
 fill: (x,y) => if y == 0 { rgb("#E7EEF3") } else { white },
 [#strong[Document]], [#strong[Purpose for this demo]],
 [Wiring schematic], [Actual pin/power map, component ratings, motor disable and bring-up checklist. Fill from the parts on hand.],
 [Firmware], [Small boot, command allowlist, speed bounds, motor control, status and timeout stop implementation.],
 [Navigation], [Manual control first; one timed route or simple waypoint demonstration only if sensors are ready.],
 [Connectivity], [One local link, tiny command/status format and disconnect behavior. No public internet.],
 [Dashboard], [Connection/mode/fault display, basic controls, and prominent stop button.],
 [Security], [No committed secrets, local-only link, input checks, stop/disconnect test and honest limitations.],
)

= Safety and acceptance

Test with wheels lifted first, low speed, a clear bounded area, a spotter, and an accessible physical power cut-off or @estop. Never operate near roads, stairs, people, or fragile equipment. Stop immediately on unexpected motion or a failed stop. Firmware stop is not a substitute for a physical stop.

The demo is ready when the rover (or clearly labelled simulator) starts reliably, accepts only the small documented command set, displays connection/status, stops on command and on disconnect, and completes the same simple demo route three times. Document unimplemented features. The supplied slides’ detector metrics, security claims, and example timeout values are not validated requirements for this class project.

= Glossary
#print-glossary(terms, show-all: true, disable-back-references: true)
