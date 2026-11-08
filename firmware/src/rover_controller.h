#pragma once
#include <Arduino.h>

#include "ble_control.h"
#include "board_config.h"
#include "drive.h"
#include "gps_module.h"
#include "mqtt_link.h"
#include "safety_state.h"
#include <DHT.h>

class RoverController {
 public:
  void begin();
  void update();

 private:
  bool acceptFrame(const String& rawFrame, uint32_t nowMs);
  void onConnection(bool connected, bool authorized, uint32_t nowMs);
  void report(const String& event);
  void sendTelemetry(uint32_t nowMs);
  void forceStop(SafetyState newState, const String& event);
  void send(const String& message);  // BLE notify + MQTT publish
  static void handleMqtt(const String& payload);

  static bool handleFrame(const String& frame, uint32_t nowMs);
  static void handleConnection(bool connected, bool authorized, uint32_t nowMs);

  static RoverController* instance_;

  Drive drive_;
  BleControl ble_;
  GpsModule gps_;
  MqttLink mqtt_;
  DHT dht_{board::DHT_PIN, board::DHT_TYPE};
  SafetyState safetyState_ = SafetyState::BOOT_SAFE;
  bool faultLatched_ = false;
  bool hasSequence_ = false;
  uint32_t lastSequence_ = 0;
  uint32_t lastCommandMs_ = 0;
  uint32_t lastTelemetryMs_ = 0;
  float currentForward_ = 0.0f;
  float currentTurn_ = 0.0f;
  float currentSpeed_ = 0.0f;
  float currentHeading_ = 0.0f;
  uint32_t lastSpeedUpdateMs_ = 0;
};
