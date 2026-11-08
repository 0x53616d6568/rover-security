#pragma once

enum class SafetyState { BOOT_SAFE, DISARMED, MANUAL, SAFE_STOP, FAULT };

const char* safetyStateName(SafetyState state);
