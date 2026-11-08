#include "safety_state.h"

const char* safetyStateName(SafetyState state) {
  switch (state) {
    case SafetyState::BOOT_SAFE:
      return "BOOT_SAFE";
    case SafetyState::DISARMED:
      return "DISARMED";
    case SafetyState::MANUAL:
      return "MANUAL";
    case SafetyState::SAFE_STOP:
      return "SAFE_STOP";
    case SafetyState::FAULT:
      return "FAULT";
  }
  return "FAULT";
}
