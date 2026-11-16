/*
  main.cpp — attaquant
  Role: BLE central/scanner for the "cible" (ENISOLAR-ROVER).
  Read-only test: scan -> connect (no pairing) -> enumerate GATT -> read
  characteristics that advertise the 'read' property. No writes, no pairing.
  Logs each of the four outcomes explicitly: ADVERTISED / CONNECTED / ENUMERATED / READABLE.
*/

#include <Arduino.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>
#include <BLEClient.h>

static const char* TARGET_NAME = "ENISOLAR-ROVER";
static const uint32_t SCAN_SECONDS = 15;

BLEAdvertisedDevice* foundDevice = nullptr;
bool deviceFound = false;

void logLine(const char* tag, const String& msg) {
  Serial.printf("[%8lu ms][%s] %s\n", millis(), tag, msg.c_str());
}

class AdvCallbacks : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    const String name = advertisedDevice.haveName() ? advertisedDevice.getName().c_str() : "";

    if (name.length() > 0) {
      logLine("SEEN", "Discovered: '" + name + "' [" + String(advertisedDevice.getAddress().toString().c_str()) + "]");
    }

    // Pure black-box discovery: match strictly by broadcasted name (no hardcoded UUIDs)
    if (name == TARGET_NAME) {
      logLine("ADVERTISED", "Target advertisement found by broadcast name!");
      logLine("ADVERTISED", "  name=" + name);
      logLine("ADVERTISED", "  address=" + String(advertisedDevice.getAddress().toString().c_str()));
      if (advertisedDevice.haveRSSI()) {
        logLine("ADVERTISED", "  rssi=" + String(advertisedDevice.getRSSI()) + " dBm");
      }

      if (!deviceFound) {
        deviceFound = true;
        foundDevice = new BLEAdvertisedDevice(advertisedDevice);
        BLEDevice::getScan()->stop();
      }
    }
  }
};

void printPropertyFlags(BLERemoteCharacteristic* chr, String& out) {
  out = "";
  if (chr->canRead())            out += "read ";
  if (chr->canWrite())           out += "write ";
  if (chr->canWriteNoResponse()) out += "write-no-rsp ";
  if (chr->canNotify())          out += "notify ";
  if (chr->canIndicate())        out += "indicate ";
  if (chr->canBroadcast())       out += "broadcast ";
}

void enumerateAndRead(BLEClient* client) {
  std::map<std::string, BLERemoteService*>* services = client->getServices();
  Serial.println();
  Serial.println("================================================================================");
  Serial.printf(">>> GATT DISCOVERY & ENUMERATION REPORT (Services Found: %d) <<<\n", services->size());
  Serial.println("================================================================================");

  for (auto& svcPair : *services) {
    BLERemoteService* service = svcPair.second;
    const String svcUuid = service->getUUID().toString().c_str();
    // Standard Bluetooth SIG services start with 000018xx; all others are custom vendor services:
    const bool isStandardSig = svcUuid.startsWith("000018");

    Serial.println();
    if (!isStandardSig) {
      Serial.printf("⭐ [CUSTOM VENDOR SERVICE DISCOVERED] UUID: %s\n", svcUuid.c_str());
    } else {
      Serial.printf("🔹 [STANDARD BLUETOOTH SIG SERVICE] UUID: %s\n", svcUuid.c_str());
    }

    std::map<std::string, BLERemoteCharacteristic*>* chars = service->getCharacteristics();
    for (auto& chrPair : *chars) {
      BLERemoteCharacteristic* chr = chrPair.second;
      String props;
      printPropertyFlags(chr, props);
      Serial.printf("    • CHARACTERISTIC: %s\n", chr->getUUID().toString().c_str());
      Serial.printf("      Properties : [ %s]\n", props.c_str());

      if (chr->canRead()) {
        std::string value = chr->readValue();
        String hex = "";
        String ascii = "";
        for (size_t i = 0; i < value.size(); i++) {
          char buf[4];
          snprintf(buf, sizeof(buf), "%02X ", (uint8_t)value[i]);
          hex += buf;
          char c = value[i];
          ascii += (c >= 32 && c <= 126) ? c : '.';
        }
        Serial.printf("      ├── HEX Bytes   : %s\n", hex.c_str());
        Serial.printf("      └── ASCII Value : \"%s\"\n", ascii.c_str());
      } else {
        Serial.println("      └── Value       : (Write-Only / Read Prohibited)");
      }
    }
  }
  Serial.println();
  Serial.println("================================================================================");
}

void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);  // Disable hardware brownout reset during RF current surges
  Serial.begin(115200);
  delay(1000);
  logLine("INFO", "attaquant starting. Target=" + String(TARGET_NAME));

  BLEDevice::init("attaquant-scanner");
  BLEScan* scan = BLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new AdvCallbacks());
  scan->setActiveScan(true);
  scan->setInterval(100);
  scan->setWindow(99);

  logLine("INFO", "Scanning for " + String(SCAN_SECONDS) + "s...");
  scan->start(SCAN_SECONDS, false);

  if (!deviceFound) {
    logLine("ADVERTISED", "RESULT: No matching advertisement found. Stopping.");
    return;
  }

  logLine("CONNECTED", "Attempting unpaired GATT connection...");
  BLEClient* client = BLEDevice::createClient();

  bool connected = client->connect(foundDevice);
  if (!connected) {
    logLine("CONNECTED", "RESULT: GATT connection failed/denied.");
    return;
  }
  logLine("CONNECTED", "RESULT: GATT connected without pairing.");

  enumerateAndRead(client);

  client->disconnect();
  logLine("INFO", "Disconnected. Test complete — see ADVERTISED/CONNECTED/ENUMERATED/READABLE lines above for the result log.");
}

void loop() {
  // one-shot test; results are in Serial output above
}