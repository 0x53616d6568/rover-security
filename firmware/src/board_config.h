#pragma once
#include <Arduino.h>

// Single ESP32 (WROOM) rover: BLE manual control + NEO-6M GPS + 2x BTS7960 + 1 battery.
// ASSUMED pin map: check against your wiring before flashing.
namespace board {

// ---- BLE ----
constexpr char BLE_DEVICE_NAME[] = "ENISOLAR-ROVER";
constexpr char BLE_SERVICE_UUID[] = "8f4d0001-4f4b-4e49-9e4f-454e49534f01";
constexpr char BLE_COMMAND_UUID[] = "8f4d0002-4f4b-4e49-9e4f-454e49534f01";
constexpr char BLE_STATUS_UUID[] = "8f4d0003-4f4b-4e49-9e4f-454e49534f01";
// MAC of the controlling phone/tablet (set yours; Android may randomize it).
constexpr char AUTHORIZED_CENTRAL_ADDRESS[] = "00:00:00:00:00:00";
constexpr size_t BLE_MAX_FRAME_LENGTH = 64;

// ---- MQTT ----
// Topics become drone/<DRONE_ID>/command and drone/<DRONE_ID>/telemetry.
// Set this to the drone id your UI subscribes/publishes with.
constexpr char DRONE_ID[] = "1";

// ---- Timing ----
constexpr uint32_t COMMAND_TIMEOUT_MS = 500;   // no command -> SAFE_STOP
constexpr uint32_t TELEMETRY_PERIOD_MS = 1000;
constexpr uint32_t GPS_MAX_AGE_MS = 2000;      // older fix -> VALID=0

// ---- BTS7960 #1 (left side) ----
constexpr int LEFT_RPWM_PIN = 25;
constexpr int LEFT_LPWM_PIN = 26;
constexpr int LEFT_EN_PIN = 32;    // R_EN + L_EN tied together

// ---- BTS7960 #2 (right side) ----
constexpr int RIGHT_RPWM_PIN = 27;
constexpr int RIGHT_LPWM_PIN = 14;
constexpr int RIGHT_EN_PIN = 33;   // R_EN + L_EN tied together

// ---- PWM (LEDC) ----
constexpr int PWM_CH_LEFT_R = 0;
constexpr int PWM_CH_LEFT_L = 1;
constexpr int PWM_CH_RIGHT_R = 2;
constexpr int PWM_CH_RIGHT_L = 3;
constexpr uint32_t PWM_FREQUENCY_HZ = 20000;
constexpr uint8_t PWM_RESOLUTION_BITS = 8;

// ---- GPS NEO-6M on UART2 ----
constexpr int GPS_RX_PIN = 16;   // ESP32 RX  <- GPS TX
constexpr int GPS_TX_PIN = 17;   // ESP32 TX  -> GPS RX
constexpr uint32_t GPS_BAUD = 9600;

// ---- Sensors ----
constexpr int DHT_PIN = 4;            // GPIO 4 (D4)
constexpr int DHT_TYPE = 11;          // DHT11
constexpr int MQ2_PIN = 35;           // ADC1_CH7 (analog in)
constexpr int BATTERY_ADC_PIN = 34;   // ADC1_CH6 (analog in)

}  // namespace board
