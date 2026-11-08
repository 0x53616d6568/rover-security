#include "mqtt_link.h"

#include <WiFi.h>

#include "board_config.h"
#include "secrets.h"

MqttLink* MqttLink::self_ = nullptr;

void MqttLink::begin(MessageHandler handler) {
  handler_ = handler;
  self_ = this;
  const String base = String("drone/") + board::DRONE_ID;
  commandTopic_ = base + "/command";
  telemetryTopic_ = base + "/telemetry";

  Serial.println("[WiFi] Starting WiFi...");
  Serial.printf("[WiFi]   SSID : %s\n", secrets::WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(secrets::WIFI_SSID, secrets::WIFI_PASSWORD);  // non-blocking

  // Print WiFi connection progress
  Serial.print("[WiFi] Connecting");
  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("[WiFi] *** CONNECTED ***");
    Serial.printf("[WiFi]   IP Address : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi]   Gateway    : %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("[WiFi]   RSSI       : %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println();
    Serial.printf("[WiFi] *** FAILED to connect to '%s' — will retry in background ***\n", secrets::WIFI_SSID);
  }

  Serial.printf("[MQTT] Server : %s:%d\n", secrets::MQTT_HOST, secrets::MQTT_PORT);
  Serial.printf("[MQTT] Drone  : %s\n", board::DRONE_ID);
  Serial.printf("[MQTT] Topics : cmd=%s  telem=%s\n", commandTopic_.c_str(), telemetryTopic_.c_str());

  tls_.setInsecure();  // same as ENISOLAR; pin the HiveMQ CA later for production
  tls_.setTimeout(3);  // seconds
  mqtt_.setServer(secrets::MQTT_HOST, secrets::MQTT_PORT);
  mqtt_.setCallback(onMessage);
  mqtt_.setBufferSize(512);
  mqtt_.setSocketTimeout(3);
}

bool MqttLink::tryConnect() {
  const String clientId = String("rover_") + board::DRONE_ID;
  Serial.printf("[MQTT] Connecting as '%s'...\n", clientId.c_str());
  if (!mqtt_.connect(clientId.c_str(), secrets::MQTT_USER, secrets::MQTT_PASS)) {
    Serial.printf("[MQTT] *** CONNECT FAILED *** rc=%d\n", mqtt_.state());
    return false;
  }
  mqtt_.subscribe(commandTopic_.c_str());
  Serial.println("[MQTT] *** CONNECTED ***");
  Serial.printf("[MQTT]   Subscribed to : %s\n", commandTopic_.c_str());
  Serial.printf("[MQTT]   Publishing to : %s\n", telemetryTopic_.c_str());
  return true;
}

void MqttLink::update(bool allowReconnect) {
  if (mqtt_.connected()) {
    mqtt_.loop();
    return;
  }
  // Log WiFi status changes
  static wl_status_t lastWifiStatus = WL_IDLE_STATUS;
  wl_status_t wifiStatus = WiFi.status();
  if (wifiStatus != lastWifiStatus) {
    Serial.printf("[WiFi] Status changed: %d -> %d  IP=%s\n",
                  lastWifiStatus, wifiStatus, WiFi.localIP().toString().c_str());
    lastWifiStatus = wifiStatus;
  }
  const uint32_t now = millis();
  if (allowReconnect && WiFi.status() == WL_CONNECTED &&
      static_cast<uint32_t>(now - lastAttemptMs_) >= 5000) {
    lastAttemptMs_ = now;
    tryConnect();
  }
}

void MqttLink::publish(const String& message) {
  if (mqtt_.connected()) {
    Serial.printf("[MQTT] >>> PUB %s\n", message.c_str());
    mqtt_.publish(telemetryTopic_.c_str(), message.c_str());
  }
}

bool MqttLink::connected() {
  return mqtt_.connected();
}

void MqttLink::onMessage(char* topic, uint8_t* payload, unsigned int length) {
  if (self_ == nullptr || self_->handler_ == nullptr) return;
  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += static_cast<char>(payload[i]);
  Serial.printf("[MQTT] <<< RCV topic=%s  payload=%s\n", topic, msg.c_str());
  self_->handler_(msg);
}
