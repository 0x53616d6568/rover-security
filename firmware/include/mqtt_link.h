#pragma once
#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

// MQTT transport for the rover. Receives the same "CMD,..." frames as BLE on
// <base>/command and publishes the same telemetry text on <base>/telemetry.
class MqttLink {
 public:
  using MessageHandler = void (*)(const String& payload);

  void begin(MessageHandler handler);
  // allowReconnect=false while driving: a TLS reconnect can block for seconds.
  void update(bool allowReconnect);
  void publish(const String& message);
  bool connected();

 private:
  static void onMessage(char* topic, uint8_t* payload, unsigned int length);
  bool tryConnect();

  static MqttLink* self_;
  WiFiClientSecure tls_;
  PubSubClient mqtt_{tls_};
  MessageHandler handler_ = nullptr;
  String commandTopic_;
  String telemetryTopic_;
  uint32_t lastAttemptMs_ = 0;
};
