#pragma once
#include <Arduino.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

// One MQTT endpoint. The rover uses two independent links so telemetry and
// command traffic can live on separate brokers and separate credentials:
//
//   telemetry link : publish-only (rover -> dashboard telemetry)
//   command link   : subscribe-only (dashboard -> rover commands)
//
// A link never both publishes and subscribes. This keeps a leaked telemetry
// credential from being usable to drive the rover.
struct MqttEndpoint {
  String host;
  uint16_t port = 8883;
  String user;
  String pass;
  String clientId;
  String topic;
  bool publish = false;
  bool subscribe = false;
  // Optional retained last-will topic (telemetry link only).
  String availabilityTopic;
};

class MqttLink {
 public:
  using MessageHandler = void (*)(const String& payload);

  // Bring up the shared WiFi STA connection once, before beginning any link.
  // Uses the persisted credentials when present, otherwise the compiled-in ones.
  static void beginNetwork();
  // Store WiFi credentials for the next network bring-up and persist them.
  static void saveNetworkCredentials(const String& ssid, const String& password);
  // Re-initialize the WiFi radio with the stored credentials and let the live
  // MQTT links reconnect to the network they describe.
  static void restartNetwork();
  static bool networkConnected();

  bool begin(const MqttEndpoint& endpoint, MessageHandler handler = nullptr);
  // allowReconnect=false while driving: a TLS reconnect can block for seconds.
  void update(bool allowReconnect);
  bool publish(const String& message);
  bool connected();
  bool configured() const { return slot_ >= 0; }
  const String& topic() const { return topic_; }

 private:
  static constexpr uint8_t kMaxLinks = 2;

  static MqttLink* instances_[kMaxLinks];
  static void dispatch0(char* topic, uint8_t* payload, unsigned int length);
  static void dispatch1(char* topic, uint8_t* payload, unsigned int length);
  static void dispatch(MqttLink* link, char* topic, uint8_t* payload, unsigned int length);
  void onPayload(char* topic, uint8_t* payload, unsigned int length);

  bool tryConnect();

  // Shared WiFi bring-up with explicit credentials (boot + WiFi init paths).
  static void startNetwork(const String& ssid, const String& password);

  // Persisted WiFi credentials (written by saveNetworkCredentials, read at boot).
  static String savedSsid_;
  static String savedPassword_;
  static bool savedCredentialsValid_;

  WiFiClientSecure tls_;
  PubSubClient mqtt_{tls_};
  MessageHandler handler_ = nullptr;
  int8_t slot_ = -1;

  String host_;
  uint16_t port_ = 8883;
  String user_;
  String pass_;
  String clientId_;
  String topic_;
  String availabilityTopic_;
  bool publishEnabled_ = false;
  bool subscribeEnabled_ = false;
  int lastWifiStatus_ = -1;
  uint32_t lastAttemptMs_ = 0;
};
