@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" rover_firmware_workbench.py
) else (
    python rover_firmware_workbench.py
)
