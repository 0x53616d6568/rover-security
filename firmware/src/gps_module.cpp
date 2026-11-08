#include "gps_module.h"

#include "board_config.h"

void GpsModule::begin() {
  Serial2.begin(board::GPS_BAUD, SERIAL_8N1, board::GPS_RX_PIN, board::GPS_TX_PIN);
}

void GpsModule::update() {
  while (Serial2.available()) {
    gps_.encode(static_cast<char>(Serial2.read()));
  }
  if (gps_.location.isValid() && gps_.location.isUpdated()) {
    lastFixMs_ = millis();
    everFixed_ = true;
  }
}

bool GpsModule::hasFix(uint32_t nowMs) const {
  return everFixed_ && static_cast<uint32_t>(nowMs - lastFixMs_) <= board::GPS_MAX_AGE_MS;
}

uint32_t GpsModule::ageMs(uint32_t nowMs) const {
  return everFixed_ ? static_cast<uint32_t>(nowMs - lastFixMs_) : 0;
}
