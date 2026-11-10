#include "mqtt_link.h"

#include <Preferences.h>
#include <WiFi.h>

#include "secrets.h"

MqttLink* MqttLink::instances_[MqttLink::kMaxLinks] = {nullptr, nullptr};

String MqttLink::savedSsid_;
String MqttLink::savedPassword_;
bool MqttLink::savedCredentialsValid_ = false;

void MqttLink::saveNetworkCredentials(const String& ssid, const String& password) {
  savedSsid_ = ssid;
  savedPassword_ = password;
  savedCredentialsValid_ = true;

  // Persist across reboots so a flashed rover can rejoin its network without a
  // BLE/MQTT credential push. Preferences lives in the ESP32 NVS partition.
  Preferences prefs;
  if (prefs.begin("rover_wifi", false)) {
    prefs.putString("ssid", ssid);
    prefs.putString("password", password);
    prefs.end();
  }

  Serial.printf("[WIFI] Credentials saved — SSID='%s' (password stored)\n", ssid.c_str());
}

void MqttLink::beginNetwork() {
  String ssid = String(secrets::WIFI_SSID);
  String password = String(secrets::WIFI_PASSWORD);

  Preferences prefs;
  if (prefs.begin("rover_wifi", false)) {
    if (prefs.isKey("ssid")) {
      ssid = prefs.getString("ssid", String(""));
      password = prefs.getString("password", String(""));
    }
    prefs.end();
  }

  startNetwork(ssid, password);
}

void MqttLink::restartNetwork() {
  if (!savedCredentialsValid_ || savedSsid_.length() == 0 || savedPassword_.length() == 0) {
    Serial.println("[WIFI] *** RESTART REJECTED — no credentials stored ***");
    return;
  }

  Serial.println("[WIFI] *** RESTARTING NETWORK with updated credentials ***");
  startNetwork(savedSsid_, savedPassword_);
}

void MqttLink::startNetwork(const String& ssid, const String& password) {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.println("[WiFi] Starting WiFi...");
  Serial.printf("[WiFi]   SSID : %s\n", ssid.c_str());
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setTxPower(WIFI_POWER_15dBm);  // Smooth out RF current spikes for breadboard power
  WiFi.begin(ssid.c_str(), password.c_str());  // non-blocking

  Serial.print("[WiFi] Connecting");
  uint8_t attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("[WiFi] *** CONNECTED ***");
    Serial.printf("[WiFi]   IP Address : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi]   Gateway    : %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("[WiFi]   RSSI       : %d dBm\n", WiFi.RSSI());
  } else {
    Serial.printf("[WiFi] *** FAILED to connect to '%s' — will retry in background ***\n", ssid.c_str());
  }

  // Drop per-link retry bookkeeping so both MQTT links retry against the new AP.
  for (MqttLink* link : instances_) {
    if (link != nullptr) {
      link->lastAttemptMs_ = 0;
      link->lastWifiStatus_ = -1;
    }
  }
}

bool MqttLink::networkConnected() {
  return WiFi.status() == WL_CONNECTED;
}

bool MqttLink::begin(const MqttEndpoint& endpoint, MessageHandler handler) {
  // Release a previous slot if begin() is called twice on the same object.
  if (slot_ >= 0 && slot_ < static_cast<int8_t>(kMaxLinks) && instances_[slot_] == this) {
    instances_[slot_] = nullptr;
  }
  slot_ = -1;

  for (uint8_t i = 0; i < kMaxLinks; ++i) {
    if (instances_[i] == nullptr) {
      slot_ = static_cast<int8_t>(i);
      break;
    }
  }
  if (slot_ < 0) {
    Serial.println("[MQTT] *** no free link slot ***");
    return false;
  }
  if (endpoint.host.length() == 0 || endpoint.topic.length() == 0) {
    Serial.println("[MQTT] *** endpoint missing host or topic ***");
    return false;
  }

  handler_ = handler;
  host_ = endpoint.host;
  port_ = endpoint.port;
  user_ = endpoint.user;
  pass_ = endpoint.pass;
  clientId_ = endpoint.clientId;
  topic_ = endpoint.topic;
  availabilityTopic_ = endpoint.availabilityTopic;
  publishEnabled_ = endpoint.publish;
  subscribeEnabled_ = endpoint.subscribe;
  lastAttemptMs_ = 0;
  lastWifiStatus_ = -1;

  instances_[slot_] = this;
  mqtt_.setCallback(slot_ == 0 ? dispatch0 : dispatch1);

  tls_.setInsecure();  // same as before; pin the HiveMQ CA later for production
  tls_.setTimeout(3);  // seconds
  mqtt_.setServer(host_.c_str(), port_);
  mqtt_.setBufferSize(512);
  mqtt_.setSocketTimeout(3);

  Serial.printf("[MQTT] Link '%s' -> %s:%u  %s%s\n", clientId_.c_str(), host_.c_str(), port_,
                publishEnabled_ ? "publish " : "", subscribeEnabled_ ? "subscribe" : "");
  Serial.printf("[MQTT]   Topic : %s\n", topic_.c_str());
  if (availabilityTopic_.length() > 0) {
    Serial.printf("[MQTT]   LWT   : %s\n", availabilityTopic_.c_str());
  }
  return true;
}

bool MqttLink::tryConnect() {
  if (!networkConnected()) return false;

  Serial.printf("[MQTT] Connecting '%s'...\n", clientId_.c_str());

  boolean ok = false;
  if (publishEnabled_ && availabilityTopic_.length() > 0) {
    // Register the last will first: if the rover dies, the broker marks it
    // offline instead of leaving a stale "online" retained value.
    ok = mqtt_.connect(clientId_.c_str(), user_.c_str(), pass_.c_str(),
                       availabilityTopic_.c_str(), 1, true, "offline");
  } else {
    ok = mqtt_.connect(clientId_.c_str(), user_.c_str(), pass_.c_str());
  }

  if (!ok) {
    Serial.printf("[MQTT] *** CONNECT FAILED *** rc=%d\n", mqtt_.state());
    return false;
  }

  if (subscribeEnabled_) {
    mqtt_.subscribe(topic_.c_str(), 1);
    Serial.printf("[MQTT]   Subscribed to : %s\n", topic_.c_str());
  }
  if (publishEnabled_) {
    Serial.printf("[MQTT]   Publishing to : %s\n", topic_.c_str());
    if (availabilityTopic_.length() > 0) {
      mqtt_.publish(availabilityTopic_.c_str(), "online", true);
    }
  }

  Serial.println("[MQTT] *** CONNECTED ***");
  return true;
}

void MqttLink::update(bool allowReconnect) {
  if (mqtt_.connected()) {
    mqtt_.loop();
    return;
  }

  const int wifiStatus = static_cast<int>(WiFi.status());
  if (wifiStatus != lastWifiStatus_) {
    Serial.printf("[WiFi] Status changed: %d -> %d  IP=%s\n", lastWifiStatus_, wifiStatus,
                  WiFi.localIP().toString().c_str());
    lastWifiStatus_ = wifiStatus;
  }

  const uint32_t now = millis();
  if (allowReconnect && networkConnected() &&
      static_cast<uint32_t>(now - lastAttemptMs_) >= 5000) {
    lastAttemptMs_ = now;
    tryConnect();
  }
}

bool MqttLink::publish(const String& message) {
  if (!publishEnabled_ || !mqtt_.connected()) return false;
  Serial.printf("[MQTT] >>> PUB %s\n", message.c_str());
  return mqtt_.publish(topic_.c_str(), message.c_str());
}

bool MqttLink::connected() {
  return mqtt_.connected();
}

void MqttLink::dispatch0(char* topic, uint8_t* payload, unsigned int length) {
  dispatch(instances_[0], topic, payload, length);
}

void MqttLink::dispatch1(char* topic, uint8_t* payload, unsigned int length) {
  dispatch(instances_[1], topic, payload, length);
}

void MqttLink::dispatch(MqttLink* link, char* topic, uint8_t* payload, unsigned int length) {
  if (link != nullptr) link->onPayload(topic, payload, length);
}

void MqttLink::onPayload(char* topic, uint8_t* payload, unsigned int length) {
  if (handler_ == nullptr) return;

  String msg;
  msg.reserve(length);
  for (unsigned int i = 0; i < length; i++) msg += static_cast<char>(payload[i]);
  Serial.printf("[MQTT] <<< RCV topic=%s  payload=%s\n", topic, msg.c_str());
  handler_(msg);
}
