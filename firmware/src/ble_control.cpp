#include "ble_control.h"

#include "board_config.h"

class RoverServerCallbacks final : public NimBLEServerCallbacks {
 public:
  void onConnect(NimBLEServer* server, NimBLEConnInfo& connectionInfo) override {
    const String address = connectionInfo.getAddress().toString().c_str();
    const bool allowAny = strlen(board::AUTHORIZED_CENTRAL_ADDRESS) == 0 ||
                          strcmp(board::AUTHORIZED_CENTRAL_ADDRESS, "00:00:00:00:00:00") == 0;
    const bool authorized = allowAny || String(board::AUTHORIZED_CENTRAL_ADDRESS).equalsIgnoreCase(address);
    Serial.println("========================================");
    Serial.printf("[BLE] *** CENTRAL CONNECTED ***\n");
    Serial.printf("[BLE]   Address : %s\n", address.c_str());
    Serial.printf("[BLE]   Mode    : %s\n", allowAny ? "OPEN (any central allowed)" : "RESTRICTED");
    Serial.printf("[BLE]   Auth    : %s\n", authorized ? "AUTHORIZED" : "REJECTED");
    Serial.println("========================================");
    ble_->connected_ = true;
    ble_->authorized_ = authorized;
    if (ble_->connectionHandler_) ble_->connectionHandler_(true, authorized, millis());
    if (!authorized) {
      Serial.printf("[BLE] Disconnecting unauthorized central: %s\n", address.c_str());
      server->disconnect(connectionInfo.getConnHandle());
    }
  }

  void onDisconnect(NimBLEServer*, NimBLEConnInfo& info, int reason) override {
    Serial.println("========================================");
    Serial.printf("[BLE] *** CENTRAL DISCONNECTED ***\n");
    Serial.printf("[BLE]   Address : %s\n", info.getAddress().toString().c_str());
    Serial.printf("[BLE]   Reason  : %d\n", reason);
    Serial.println("========================================");
    ble_->connected_ = false;
    ble_->authorized_ = false;
    if (ble_->connectionHandler_) ble_->connectionHandler_(false, false, millis());
    Serial.println("[BLE] Restarting advertising...");
    NimBLEDevice::getAdvertising()->start();
    Serial.println("[BLE] Advertising restarted");
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
    if (!ble_->connected_ || !ble_->authorized_) {
      Serial.println("[BLE] onWrite IGNORED — not connected or not authorized");
      return;
    }
    const bool allowAny = strlen(board::AUTHORIZED_CENTRAL_ADDRESS) == 0 ||
                          strcmp(board::AUTHORIZED_CENTRAL_ADDRESS, "00:00:00:00:00:00") == 0;
    if (!allowAny && !String(board::AUTHORIZED_CENTRAL_ADDRESS).equalsIgnoreCase(
            connectionInfo.getAddress().toString().c_str())) {
      Serial.printf("[BLE] onWrite REJECTED — sender %s not authorized\n",
                    connectionInfo.getAddress().toString().c_str());
      return;
    }
    const String val = characteristic->getValue().c_str();
    Serial.printf("[BLE] <<< RX frame (%d bytes): %s\n", val.length(), val.c_str());
    if (ble_->frameHandler_) {
      ble_->frameHandler_(val, millis());
    }
  }

 private:
  BleControl* ble_;
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
  statusCharacteristic_->setValue("STATE=DISARMED;VALID=0;SENSOR_DATA=UNAVAILABLE");
  service->start();

  NimBLEDevice::getAdvertising()->addServiceUUID(board::BLE_SERVICE_UUID);
  NimBLEDevice::getAdvertising()->start();
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
