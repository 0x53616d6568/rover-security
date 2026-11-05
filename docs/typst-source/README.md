# Project plan source

The five-day Phase 1 project plan is authored in `main.typ` and uses the colocated `report-theme.typ`. The source has no external Typst package dependency.

Build from this directory with Typst installed:

```sh
typst compile main.typ ../project-plan.pdf
```

The `.typst-content-manifest.json` and `.typst-build-plan.json` record the existing-project routing and local-theme preflight. The rendered plan is [`../project-plan.pdf`](../project-plan.pdf). The plan is deliberately limited to one main ESP32, one auxiliary ESP32-CAM, manual phone control over BLE, and validated sensor telemetry.
