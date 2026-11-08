#pragma once
#include <Arduino.h>
#include <TinyGPSPlus.h>

// NEO-6M reader on Serial2. Call update() every loop iteration.
class GpsModule {
 public:
  void begin();
  void update();
  bool hasFix(uint32_t nowMs) const;
  uint32_t ageMs(uint32_t nowMs) const;
  double lat() { return gps_.location.lat(); }
  double lng() { return gps_.location.lng(); }
  float speedKmh() { return gps_.speed.kmph(); }
  float speedMps() { return gps_.speed.mps(); }
  float courseDeg() { return gps_.course.deg(); }
  uint32_t satellites() { return gps_.satellites.isValid() ? gps_.satellites.value() : 0; }

 private:
  TinyGPSPlus gps_;
  uint32_t lastFixMs_ = 0;
  bool everFixed_ = false;
};
