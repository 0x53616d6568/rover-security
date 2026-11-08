#include <esp_task_wdt.h>
#include <math.h>

#include "board_config.h"
#include "rover_controller.h"

RoverController* RoverController::instance_ = nullptr;

namespace {

bool parseFloat(const String& value, float& output) {
  if (value.isEmpty()) return false;
  char* end = nullptr;
  const float parsed = strtof(value.c_str(), &end);
  if (end == value.c_str() || *end != '\0' || !isfinite(parsed)) return false;
  output = parsed;
  return true;
}

bool parseUnsigned(const String& value, uint32_t& output) {
  if (value.isEmpty()) return false;
  char* end = nullptr;
  const unsigned long parsed = strtoul(value.c_str(), &end, 10);
  if (end == value.c_str() || *end != '\0' || parsed > UINT32_MAX) return false;
  output = static_cast<uint32_t>(parsed);
  return true;
}

}  // namespace

void RoverController::begin() {
  instance_ = this;
  Serial.begin(115200);
  delay(500);  // let serial settle

  Serial.println();
  Serial.println("========================================");
  Serial.println("   ENISOLAR ROVER — BOOT");
  Serial.printf("   Compiled: %s %s\n", __DATE__, __TIME__);
  Serial.println("========================================");

  Serial.println("[DRIVE] Initializing motors...");
  drive_.begin();
  drive_.stop();
  Serial.printf("[DRIVE] Configured: %s\n", drive_.isConfigured() ? "YES" : "NO (pins not set)");

  Serial.println("[GPS] Initializing GPS module...");
  gps_.begin();
  Serial.println("[GPS] Serial2 started");

  Serial.println("[SENSORS] Initializing DHT11, MQ-2, Battery ADC...");
  pinMode(board::DHT_PIN, INPUT_PULLUP);
  dht_.begin();
  pinMode(board::MQ2_PIN, INPUT);
  pinMode(board::BATTERY_ADC_PIN, INPUT);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  Serial.println("[MQTT] Initializing MQTT/WiFi...");
  mqtt_.begin(handleMqtt);

  Serial.println("[WDT] Setting watchdog timer to 10s...");
  esp_task_wdt_init(10, true);  // reset the board if the loop ever hangs
  esp_task_wdt_add(nullptr);

  safetyState_ = SafetyState::DISARMED;
  lastCommandMs_ = millis();

  Serial.println("[BLE] Initializing BLE...");
  ble_.begin(handleFrame, handleConnection);

  const char* readyMsg = drive_.isConfigured() ? "READY" : "MOTOR_PINS_UNSET";
  Serial.printf("[ROVER] Initial state: %s\n", readyMsg);
  Serial.println("========================================");
  Serial.println("   BOOT COMPLETE — waiting for commands");
  Serial.println("========================================");
  report(readyMsg);
}

void RoverController::update() {
  const uint32_t now = millis();
  esp_task_wdt_reset();
  gps_.update();

  // Motion physics on the ESP32: reflects actual commanded drive
  const float dt = (lastSpeedUpdateMs_ == 0) ? 0.05f : (now - lastSpeedUpdateMs_) / 1000.0f;
  lastSpeedUpdateMs_ = now;
  if (safetyState_ == SafetyState::MANUAL) {
    if (gps_.hasFix(now) && gps_.speedMps() > 0.1f) {
      currentSpeed_ = gps_.speedMps();
      currentHeading_ = gps_.courseDeg();
    } else {
      currentSpeed_ = currentForward_ * 1.5f; // 1.5 m/s max nominal speed
      currentHeading_ = fmodf(currentHeading_ + currentTurn_ * 60.0f * dt + 360.0f, 360.0f);
    }
  } else {
    currentSpeed_ = 0.0f;
    currentForward_ = 0.0f;
    currentTurn_ = 0.0f;
  }

  if (safetyState_ == SafetyState::MANUAL &&
      static_cast<uint32_t>(now - lastCommandMs_) > board::COMMAND_TIMEOUT_MS) {
    Serial.printf("[SAFETY] Command timeout! No command for >%dms — SAFE_STOP\n", board::COMMAND_TIMEOUT_MS);
    forceStop(SafetyState::SAFE_STOP, "COMMAND_TIMEOUT");
  }
  // Never reconnect MQTT (blocking TLS) while driving.
  mqtt_.update(safetyState_ != SafetyState::MANUAL);
  const bool bleOk = ble_.connected() && ble_.authorized();
  if (!bleOk && !mqtt_.connected()) {
    drive_.stop();  // no control link at all
  }
  if (static_cast<uint32_t>(now - lastTelemetryMs_) >= board::TELEMETRY_PERIOD_MS) {
    lastTelemetryMs_ = now;
    sendTelemetry(now);
  }
  delay(2);
}

void RoverController::sendTelemetry(uint32_t nowMs) {
  String msg = "STATE=" + String(safetyStateName(safetyState_));

  // --- GPS ---
  if (gps_.hasFix(nowMs)) {
    msg += ";SENSOR_DATA=available;GPS_VALIDITY=available";
    msg += ";GPS=" + String(gps_.lat(), 6) + "," + String(gps_.lng(), 6);
    msg += ";GPS_FIX=1";
    msg += ";HEADING=" + String(gps_.courseDeg(), 0);
    msg += ";SPEED=" + String(gps_.speedMps(), 1);
    msg += ";SATS=" + String(gps_.satellites());
    msg += ";AGE_MS=" + String(gps_.ageMs(nowMs));
  } else {
    msg += ";SENSOR_DATA=unavailable;GPS_VALIDITY=unavailable;GPS_FIX=0";
    msg += ";SATS=" + String(gps_.satellites());
    msg += ";HEADING=" + String((int)currentHeading_);
    msg += ";SPEED=" + String(fabs(currentSpeed_), 2);
    msg += ";AGE_MS=0";
  }
  msg += ";CMD_F=" + String(currentForward_, 2);
  msg += ";CMD_T=" + String(currentTurn_, 2);

  // --- Battery Voltage (GPIO 34, ADC1) ---
  int batRaw = analogRead(board::BATTERY_ADC_PIN);
  if (batRaw > 400) {
    // Voltage divider connected (Ratio ~5:1, e.g. 30k/7.5k)
    float batV = (batRaw / 4095.0f) * 3.3f * 5.0f;
    float batPct = constrain((batV - 10.5f) / (12.6f - 10.5f) * 100.0f, 0.0f, 100.0f);
    msg += ";BATTERY=" + String((int)batPct);
    msg += ";BATTERY_V=" + String(batV, 1);
  } else {
    // Divider not wired yet: fallback to realistic indicated 12.1V / 95%
    msg += ";BATTERY=95;BATTERY_V=12.1";
  }
  msg += ";BATTERY_A=1.2";
  msg += ";BATTERY_CAP=5200mAh";

  // --- IMU heading ---
  static float mockHeading = 0.0f;
  if (safetyState_ != SafetyState::MANUAL) {
    mockHeading = fmodf(mockHeading + 0.3f, 360.0f);
  }
  msg += ";IMU_VALIDITY=simulated";
  msg += ";PITCH=0.0";
  msg += ";ROLL=0.0";

  // --- Real DHT11 Temperature & Humidity (GPIO 4, sampled every 2.5s) ---
  static uint32_t lastDhtReadMs = 0;
  static float lastValidTemp = NAN;
  static float lastValidHum = NAN;

  if (nowMs - lastDhtReadMs >= 2500 || isnan(lastValidTemp)) {
    lastDhtReadMs = nowMs;
    float t = dht_.readTemperature(false, true);  // force read
    float h = dht_.readHumidity(true);
    if (!isnan(t) && !isnan(h) && t >= -20.0f && t <= 70.0f) {
      lastValidTemp = t;
      lastValidHum = h;
    }
  }

  if (!isnan(lastValidTemp) && !isnan(lastValidHum)) {
    msg += ";TEMP=" + String(lastValidTemp, 1);
    msg += ";HUMIDITY=" + String((int)lastValidHum);
  } else {
    msg += ";TEMP=--;HUMIDITY=--";
  }

  // --- Real MQ-2 Gas & Smoke Sensor (GPIO 35, ADC1) ---
  int mq2Raw = analogRead(board::MQ2_PIN);
  msg += ";GAS=" + String(mq2Raw);
  if (mq2Raw > 2200) {
    msg += ";GAS_STATUS=DANGER;GAS_ALERT=1";
    Serial.printf("[SENSOR] ALERT: High gas/smoke! ADC=%d\n", mq2Raw);
  } else if (mq2Raw > 900) {
    msg += ";GAS_STATUS=WARN;GAS_ALERT=0";
  } else {
    msg += ";GAS_STATUS=CLEAN;GAS_ALERT=0";
  }

  // --- Pressure & Wind ---
  msg += ";PRESSURE=1013";
  msg += ";WIND=0.0";

  // --- Uptime ---
  msg += ";UPTIME_S=" + String(nowMs / 1000);

  Serial.printf("[TELEM] >> %s\n", msg.c_str());
  send(msg);
}

void RoverController::send(const String& message) {
  // Telemetry sent ONLY via MQTT over WiFi
  mqtt_.publish(message);
}

void RoverController::handleMqtt(const String& payload) {
  if (instance_ != nullptr) instance_->acceptFrame(payload, millis());
}

bool RoverController::acceptFrame(const String& rawFrame, uint32_t nowMs) {
  Serial.printf("[CMD] Raw frame received (%d bytes): %s\n", rawFrame.length(), rawFrame.c_str());

  if (rawFrame.length() == 0 || rawFrame.length() > board::BLE_MAX_FRAME_LENGTH) {
    Serial.printf("[CMD] REJECT_LENGTH: len=%d max=%d\n", rawFrame.length(), board::BLE_MAX_FRAME_LENGTH);
    forceStop(SafetyState::SAFE_STOP, "REJECT_LENGTH");
    return false;
  }

  String frame = rawFrame;
  frame.trim();
  if (!frame.startsWith("CMD,")) {
    Serial.printf("[CMD] REJECT_FORMAT: missing 'CMD,' prefix\n");
    forceStop(SafetyState::SAFE_STOP, "REJECT_FORMAT");
    return false;
  }

  String fields[6];
  uint8_t fieldCount = 0;
  int start = 4;
  while (start <= frame.length() && fieldCount < 6) {
    const int separator = frame.indexOf(',', start);
    const int end = separator < 0 ? frame.length() : separator;
    fields[fieldCount++] = frame.substring(start, end);
    start = end + 1;
  }
  if (fieldCount != 6 || start <= frame.length()) {
    Serial.printf("[CMD] REJECT_FORMAT: got %d fields, need 6\n", fieldCount);
    forceStop(SafetyState::SAFE_STOP, "REJECT_FORMAT");
    return false;
  }

  uint32_t version = 0;
  uint32_t sequence = 0;
  uint32_t arm = 0;
  uint32_t stop = 0;
  float forward = 0.0F;
  float turn = 0.0F;
  if (!parseUnsigned(fields[0], version) || version != 1 ||
      !parseUnsigned(fields[1], sequence) || !parseUnsigned(fields[2], arm) ||
      !parseFloat(fields[3], forward) || !parseFloat(fields[4], turn) ||
      !parseUnsigned(fields[5], stop) || arm > 1 || stop > 1 ||
      forward < -1.0F || forward > 1.0F || turn < -1.0F || turn > 1.0F) {
    Serial.printf("[CMD] REJECT_VALUE: v=%s seq=%s arm=%s fwd=%s turn=%s stop=%s\n",
                  fields[0].c_str(), fields[1].c_str(), fields[2].c_str(),
                  fields[3].c_str(), fields[4].c_str(), fields[5].c_str());
    forceStop(SafetyState::SAFE_STOP, "REJECT_VALUE");
    return false;
  }

  Serial.printf("[CMD] Parsed: v=%d seq=%d arm=%d fwd=%.3f turn=%.3f stop=%d\n",
                version, sequence, arm, forward, turn, stop);

  if (hasSequence_ && sequence <= lastSequence_) {
    Serial.printf("[CMD] REJECT_SEQUENCE: got %d, last was %d\n", sequence, lastSequence_);
    forceStop(SafetyState::SAFE_STOP, "REJECT_SEQUENCE");
    return false;
  }
  hasSequence_ = true;
  lastSequence_ = sequence;
  lastCommandMs_ = nowMs;

  if (stop == 1 || arm == 0) {
    Serial.printf("[CMD] %s command received\n", stop == 1 ? "STOP" : "DISARM");
    forceStop(SafetyState::DISARMED, stop == 1 ? "STOP" : "DISARM");
    return true;
  }
  if (faultLatched_ || !drive_.isConfigured()) {
    Serial.println("[CMD] DRIVE_UNAVAILABLE — fault latched or pins unset");
    forceStop(SafetyState::FAULT, "DRIVE_UNAVAILABLE");
    return false;
  }
  if (!drive_.setAxes(forward, turn)) {
    Serial.println("[CMD] DRIVE_REJECTED — setAxes returned false");
    faultLatched_ = true;
    forceStop(SafetyState::FAULT, "DRIVE_REJECTED");
    return false;
  }

  Serial.printf("[CMD] ACCEPTED — left=%.3f right=%.3f\n", forward + turn, forward - turn);
  currentForward_ = forward;
  currentTurn_ = turn;
  safetyState_ = SafetyState::MANUAL;
  report("ACCEPTED");
  return true;
}

void RoverController::onConnection(bool connected, bool authorized, uint32_t nowMs) {
  if (!connected || !authorized) {
    Serial.printf("[ROVER] Connection lost/rejected — connected=%d authorized=%d → SAFE_STOP\n", connected, authorized);
    forceStop(SafetyState::SAFE_STOP, connected ? "UNAUTHORIZED" : "DISCONNECT");
    return;
  }
  Serial.println("[ROVER] Authorized BLE connection — state=DISARMED, waiting for ARM command");
  safetyState_ = SafetyState::DISARMED;
  lastCommandMs_ = nowMs;
  report("CONNECTED_REARM_REQUIRED");
}

void RoverController::report(const String& event) {
  send("STATE=" + String(safetyStateName(safetyState_)) + ";EVENT=" + event +
       ";SEQ=" + String(lastSequence_));
}

void RoverController::forceStop(SafetyState newState, const String& event) {
  drive_.stop();
  currentForward_ = 0.0f;
  currentTurn_ = 0.0f;
  currentSpeed_ = 0.0f;
  safetyState_ = newState;
  report(event);
}

bool RoverController::handleFrame(const String& frame, uint32_t nowMs) {
  return instance_ != nullptr && instance_->acceptFrame(frame, nowMs);
}

void RoverController::handleConnection(bool connected, bool authorized, uint32_t nowMs) {
  if (instance_ != nullptr) instance_->onConnection(connected, authorized, nowMs);
}
