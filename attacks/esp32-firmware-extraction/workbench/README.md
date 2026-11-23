# Sanitized workbench source

This directory is a source-only copy of the local `D:\rover_firmware_workbench` tool described in [the attack-type README](../README.md). It contains the GUI, example settings, requirements, launcher, and bundled helper scripts.

It deliberately does **not** include:

- `evidence/` — full flash dumps
- `extracted/` — partition binaries such as `nvs.bin` and `app0.bin`
- `reports/` — unredacted NVS and string reports
- `config.json` — local tool paths and case settings
- `*_case/` — local case directories
- `.venv/` and `__pycache__/` — environment and bytecode

Those artifacts are unredacted and must stay outside the repository. The repository `.gitignore` adds defensive rules in case the tool is run from this folder.

## Run locally

From this directory, with Python and the dependencies installed:

```powershell
python .\rover_firmware_workbench.py
```

Or use `run.bat`, which prefers `.venv\Scripts\python.exe` when present. Dependencies are listed in `requirements.txt`.

Use the GUI only for authorized, read-only analysis of project-owned hardware. Keep all generated dumps and reports in local controlled storage, and rotate every credential the tool reveals.

## Bundled tools

- `tools/nvs_tool/` — Espressif NVS decoder scripts (Apache-2.0; see source SPDX headers).
- `tools/esp32_image_parser/` — ESP32 application image/ELF reconstruction helpers used by the workbench.
