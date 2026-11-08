#pragma once
#include <Arduino.h>
#include <NimBLEDevice.h>

class BleControl {
 public:
  using FrameHandler = bool (*)(const String& frame, uint32_t nowMs);
  using ConnectionHandler = void (*)(bool connected, bool authorized, uint32_t nowMs);

  void begin(FrameHandler frameHandler, ConnectionHandler connectionHandler);
  void notify(const String& status);
  bool connected() const;
  bool authorized() const;

 private:
  friend class RoverServerCallbacks;
  friend class RoverCommandCallbacks;

  NimBLEServer* server_ = nullptr;
  NimBLECharacteristic* statusCharacteristic_ = nullptr;
  FrameHandler frameHandler_ = nullptr;
  ConnectionHandler connectionHandler_ = nullptr;
  bool connected_ = false;
  bool authorized_ = false;
};
