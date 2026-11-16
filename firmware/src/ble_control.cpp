#include "ble_control.h"

#include "board_config.h"

class RoverServerCallbacks final : public NimBLEServerCallbacks {
 public:
  void onConnect(NimBLEServer* server, NimBLEConnInfo& connectionInfo) override {
    const String address = connectionInfo.getAddress().toString().c_str();
    const bool allowAny = strlen(board::AUTHORIZED_CENTRAL_ADDRESS) == 0 ||
                          strcmp(board::AUTHORIZED_CENTRAL_ADDRESS, "00:00:00:00:00:00") == 0;
    const bool authorized = allowAny || String(board::AUTHORIZED_CENTRAL_ADDRESS).equalsIgnoreCase(address);

    Serial.println();
    Serial.println("╔══════════════════════════════════════════════════════════════════════════════╗");
    Serial.println("║                    🔵 BLE CENTRAL DEVICE CONNECTED 🔵                        ║");
    Serial.println("╠══════════════════════════════════════════════════════════════════════════════╣");
    Serial.printf ("║  Central MAC Address : %-53s ║\n", address.c_str());
    Serial.printf ("║  Connection Handle   : %-53d ║\n", connectionInfo.getConnHandle());
    Serial.printf ("║  Whitelist Policy    : %-53s ║\n", allowAny ? "OPEN (Allows Any Central / Pen-Testing)" : board::AUTHORIZED_CENTRAL_ADDRESS);
    Serial.printf ("║  Authorization       : %-53s ║\n", authorized ? "✅ GRANTED — Central Authorized to control" : "❌ DENIED — Unauthorized Central");
    Serial.println("╚══════════════════════════════════════════════════════════════════════════════╝");
    Serial.println();

    ble_->connected_ = true;
    ble_->authorized_ = authorized;
    if (ble_->connectionHandler_) ble_->connectionHandler_(true, authorized, millis());

    // Do NOT disconnect unauthorized centrals — keep the link active to log incoming interactions
    if (!authorized) {
      Serial.printf("[BLE MONITOR] ⚠️ Unauthorized central connected: %s (Monitoring active — connection maintained)\n", address.c_str());
    }
  }

  void onDisconnect(NimBLEServer*, NimBLEConnInfo& info, int reason) override {
    Serial.println();
    Serial.println("╔══════════════════════════════════════════════════════════════════════════════╗");
    Serial.println("║                   ⚪ BLE CENTRAL DEVICE DISCONNECTED ⚪                     ║");
    Serial.println("╠══════════════════════════════════════════════════════════════════════════════╣");
    Serial.printf ("║  Central MAC Address : %-53s ║\n", info.getAddress().toString().c_str());
    Serial.printf ("║  Disconnect Reason   : %-53d ║\n", reason);
    Serial.println("╚══════════════════════════════════════════════════════════════════════════════╝");
    Serial.println();

    ble_->connected_ = false;
    ble_->authorized_ = false;
    if (ble_->connectionHandler_) ble_->connectionHandler_(false, false, millis());
    NimBLEDevice::getAdvertising()->start();
    Serial.println("[BLE] Advertising restarted — ready for next incoming connection");
  }

  void onMTUChange(uint16_t MTU, NimBLEConnInfo& info) override {
    Serial.printf("[BLE] MTU updated to %d bytes (Central: %s)\n",
                  MTU, info.getAddress().toString().c_str());
  }

  void setOwner(BleControl* owner) {
    ble_ = owner;
  }

 private:
  BleControl* ble_ = nullptr;
};

class RoverCommandCallbacks final : public NimBLECharacteristicCallbacks {
 public:
  explicit RoverCommandCallbacks(BleControl* owner) : ble_(owner) {}

  void onWrite(NimBLECharacteristic* characteristic, NimBLEConnInfo& connectionInfo) override {
    const String address = connectionInfo.getAddress().toString().c_str();
    const String val = characteristic->getValue().c_str();

    Serial.println();
    Serial.println("================================================================================");
    Serial.printf("[BLE INTERCEPT] <<< INCOMING GATT WRITE ON COMMAND CHARACTERISTIC <<<\n");
    Serial.printf("  ├── Source Central MAC : %s\n", address.c_str());
    Serial.printf("  ├── Frame Length       : %d bytes\n", val.length());
    Serial.printf("  ├── ASCII Payload      : %s\n", val.c_str());
    Serial.print("  ├── HEX Dump           : ");
    for (size_t i = 0; i < val.length(); ++i) {
      Serial.printf("%02X ", static_cast<uint8_t>(val[i]));
    }
    Serial.println();

    if (!ble_->connected_ || !ble_->authorized_) {
      Serial.println("  └── Security Verdict   : ❌ REJECTED (Central not connected or unauthorized)");
      Serial.println("================================================================================");
      Serial.println();
      return;
    }
    const bool allowAny = strlen(board::AUTHORIZED_CENTRAL_ADDRESS) == 0 ||
                          strcmp(board::AUTHORIZED_CENTRAL_ADDRESS, "00:00:00:00:00:00") == 0;
    if (!allowAny && !String(board::AUTHORIZED_CENTRAL_ADDRESS).equalsIgnoreCase(address)) {
      Serial.printf("  └── Security Verdict   : ❌ REJECTED (Spoofed MAC / Unauthorized sender %s)\n", address.c_str());
      Serial.println("================================================================================");
      Serial.println();
      return;
    }

    Serial.println("  └── Security Verdict   : ✅ ACCEPTED FOR FRAME PARSING");
    Serial.println("================================================================================");

    if (ble_->frameHandler_) {
      ble_->frameHandler_(val, millis(), address.c_str());
    }
  }

 private:
  BleControl* ble_;
};

class RoverStatusCallbacks final : public NimBLECharacteristicCallbacks {
 public:
  void onRead(NimBLECharacteristic* characteristic, NimBLEConnInfo& connectionInfo) override {
    const String address = connectionInfo.getAddress().toString().c_str();
    const String value = characteristic->getValue().c_str();
    const bool allowAny = strlen(board::AUTHORIZED_CENTRAL_ADDRESS) == 0 ||
                          strcmp(board::AUTHORIZED_CENTRAL_ADDRESS, "00:00:00:00:00:00") == 0;
    const bool authorized = allowAny || String(board::AUTHORIZED_CENTRAL_ADDRESS).equalsIgnoreCase(address);

    Serial.println();
    Serial.println("================================================================================");
    Serial.printf(">>> [BLE GATT READ INTERCEPTED] <<<\n");
    Serial.printf("  ├── Reader Central MAC : %s\n", address.c_str());
    Serial.printf("  ├── Authorization      : %s\n", authorized ? "✅ AUTHORIZED CONTROLLER" : "⚠️ UNAUTHORIZED / EXTERNAL CLIENT");
    Serial.printf("  ├── Target Characteristic: %s\n", characteristic->getUUID().toString().c_str());
    Serial.printf("  ├── Read Action        : GRANTED (Value delivered to client)\n");
    Serial.printf("  ├── Data Delivered     : \"%s\"\n", value.c_str());
    Serial.print ("  └── Raw HEX Bytes      : ");
    for (size_t i = 0; i < value.length(); ++i) {
      Serial.printf("%02X ", static_cast<uint8_t>(value[i]));
    }
    Serial.println();
    Serial.println("================================================================================");
    Serial.println();
  }

  void onSubscribe(NimBLECharacteristic* characteristic, NimBLEConnInfo& connectionInfo, uint16_t subValue) override {
    const String address = connectionInfo.getAddress().toString().c_str();
    Serial.printf("[BLE] <<< Central %s %s status notifications (subValue=%d)\n",
                  address.c_str(),
                  subValue ? "SUBSCRIBED to" : "UNSUBSCRIBED from",
                  subValue);
  }
};

void BleControl::begin(FrameHandler frameHandler, ConnectionHandler connectionHandler) {
  frameHandler_ = frameHandler;
  connectionHandler_ = connectionHandler;

  Serial.println("[BLE] Initializing NimBLE stack...");
  NimBLEDevice::init(board::BLE_DEVICE_NAME);
  NimBLEDevice::setSecurityAuth(true, true, true);
  NimBLEDevice::setSecurityPasskey(123456);
  Serial.printf("[BLE] Device name  : %s\n", board::BLE_DEVICE_NAME);
  Serial.printf("[BLE] Service UUID : %s\n", board::BLE_SERVICE_UUID);
  Serial.printf("[BLE] Command UUID : %s\n", board::BLE_COMMAND_UUID);
  Serial.printf("[BLE] Status UUID  : %s\n", board::BLE_STATUS_UUID);
  Serial.printf("[BLE] Auth addr    : %s\n",
    (strlen(board::AUTHORIZED_CENTRAL_ADDRESS) == 0 ||
     strcmp(board::AUTHORIZED_CENTRAL_ADDRESS, "00:00:00:00:00:00") == 0)
    ? "OPEN (any)" : board::AUTHORIZED_CENTRAL_ADDRESS);

  server_ = NimBLEDevice::createServer();
  auto* callbacks = new RoverServerCallbacks();
  callbacks->setOwner(this);
  server_->setCallbacks(callbacks);

  NimBLEService* service = server_->createService(board::BLE_SERVICE_UUID);
  NimBLECharacteristic* command = service->createCharacteristic(
      board::BLE_COMMAND_UUID, NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR);
  command->setCallbacks(new RoverCommandCallbacks(this));
  statusCharacteristic_ =
      service->createCharacteristic(board::BLE_STATUS_UUID, NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY);
  statusCharacteristic_->setCallbacks(new RoverStatusCallbacks());
  statusCharacteristic_->setValue("STATE=DISARMED;VALID=0;SENSOR_DATA=UNAVAILABLE");
  service->start();

  NimBLEAdvertising* adv = NimBLEDevice::getAdvertising();
  adv->setName(board::BLE_DEVICE_NAME);
  adv->addServiceUUID(board::BLE_SERVICE_UUID);
  adv->enableScanResponse(true);
  adv->start();
  Serial.println("[BLE] Advertising started — waiting for phone connection");
}

void BleControl::notify(const String& status) {
  if (!statusCharacteristic_ || !connected_ || !authorized_) return;
  Serial.printf("[BLE] >>> TX notify: %s\n", status.c_str());
  statusCharacteristic_->setValue(status.c_str());
  statusCharacteristic_->notify();
}

bool BleControl::connected() const {
  return connected_;
}

bool BleControl::authorized() const {
  return authorized_;
}
