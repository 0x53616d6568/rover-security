#pragma once
#include <Arduino.h>

// Differential drive on two BTS7960 modules (one per side).
class Drive {
 public:
  void begin();
  void stop();
  bool setAxes(float forward, float turn);
  bool isConfigured() const;

 private:
  float clampAxis(float value) const;
  void setSide(int chR, int chL, float value);
  bool configured_ = false;
};
