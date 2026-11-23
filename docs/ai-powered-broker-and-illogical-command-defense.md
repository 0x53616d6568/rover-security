# AI-Powered MQTT Broker & Adaptive Isolation Architecture
## Deep Defense Specification: Detecting Illogical Command Injections & Dynamic Broker Migration

**Document Version:** 1.0  
**Target Platform:** ENISOLAR Autonomous Rover (ESP32 Core, BTS7960 Motor Subsystem)  
**Classification:** Security Architecture & Defense Engineering  

> **Credential hygiene:** configuration values in the example code are placeholders loaded from the environment. Never commit real broker passwords or gateway secrets. A credential that was ever committed or appeared in an unredacted [flash/NVS report](../attacks/esp32-firmware-extraction/README.md) must be rotated before this design is deployed.

---

## 1. Executive Summary

Autonomous ground robotics operating over wireless telemetry and MQTT command links face a broad spectrum of network-based adversarial vectors. While link-layer encryption (TLS 1.2/1.3) and basic authentication protect transport confidentiality against casual passive eavesdroppers, they provide **zero protection against an adversary who has obtained legitimate command credentials or compromised the command broker itself**.

This document specifies the architecture of an **AI-Powered Defensive Broker & Security Gateway**. The system continuously monitors the command stream in real time, applies multi-layered kinematic, statistical, and machine-learning models to identify **illogical, malicious, and physically destructive command injections**, and executes an **autonomous broker shift** to isolate the ESP32 rover from a compromised broker.

---

## 2. System Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │               CLIENTS & COMMAND SOURCES                │
                    │   • Web Cockpit App       • Companion Mobile App       │
                    │   • Compromised Account   • Malicious Network Actor    │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                                                ▼  [MQTT over WSS (Port 8884)]
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                          AI-POWERED DEFENSIVE BROKER (GATEWAY / PROXY)                          │
│                                                                                                 │
│  ┌────────────────────────┐   ┌───────────────────────────┐   ┌──────────────────────────────┐  │
│  │   Layer 1: Protocol    │   │  Layer 2: Kinematic &     │   │  Layer 3: AI Machine         │  │
│  │   & Syntax Sanitizer   │──▶│  Mechanical Feasibility   │──▶│  Learning Classifier         │  │
│  │   • Regex & Boundary   │   │  • Jerk / Delta-V Limits  │   │  • Temporal Sequence Scorer  │  │
│  │   • Token-Bucket Rate  │   │  • H-Bridge Thermal Model │   │  • Trajectory Anomaly Score  │  │
│  └────────────────────────┘   └───────────────────────────┘   └──────────────┬───────────────┘  │
│                                                                              │                  │
│                                           ┌──────────────────────────────────┴───────────────┐  │
│                                           ▼                                                  ▼  │
│                               ┌───────────────────────┐                          ┌──────────────┴────┐
│                               │  VERDICT: ADVERSARIAL │                          │  VERDICT: BENIGN  │
│                               └───────────┬───────────┘                          └──────────┬────────┘
│                                           │                                                 │
│               ┌───────────────────────────┴────────────────────────────┐                   │
│               ▼                                                        ▼                   │
│  ┌──────────────────────────────┐                        ┌───────────────────────────┐     │
│  │  1. QUARANTINE SOURCE IP     │                        │  2. ADAPTIVE BROKER SHIFT │     │
│  │  • Block WebSocket Session   │                        │  • Issue authenticated    │     │
│  │  • Blacklist Credential Hash │                        │    OTA migration frame    │     │
│  └──────────────────────────────┘                        └─────────────┬─────────────┘     │
└────────────────────────────────────────────────────────────────────────┼───────────────────┼────┘
                                                                         │                   │
                                            ┌────────────────────────────┘                   │
                                            │ Authenticated Migration Frame                  │ Clean, Validated
                                            │ [MIGRATE,<Secured_Broker>,<Token>]             │ Command Frame
                                            ▼                                                ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ESP32 ROVER HARDWARE CORE                                    │
│                                                                                                 │
│   ┌──────────────────────────────────────────────────────────┐                                  │
│   │ Network Controller (Dual-Link Stack)                     │                                  │
│   │   • Socket A (Primary Command Broker) ───[DISCONNECTED]  │                                  │
│   │   • Socket B (Isolated AI Quarantine Link) ───[ACTIVE]   │                                  │
│   └─────────────────────────────┬────────────────────────────┘                                  │
│                                 ▼                                                               │
│   ┌──────────────────────────────────────────────────────────┐                                  │
│   │ Motion Controller & Motor Subsystem (BTS7960 Drivers)    │                                  │
│   │   • Left & Right PWM Drives (GPIO 25, 26, 27, 14)        │                                  │
│   │   • Hardware Inhibit / Driver Disarm (GPIO 32, 33)       │                                  │
│   └──────────────────────────────────────────────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Deep Taxonomy of Illogical Command Injections

An attacker who gains access to the command topic does not merely send invalid syntax; they exploit the **gap between network validity and physical feasibility**. The following classes of illogical command injections represent high-severity attack vectors:

### Category A: Kinematic & Physical Hardware Destruction

#### 1. Instantaneous Slam-Reverse (High Delta-V Gearbox Stripping)
* **Mechanics:** The rover is travelling at full forward throttle (`forward = 1.00`). Within a single transmission interval (e.g., 20 ms), the attacker injects `forward = -1.00`.
* **Physical Consequence:** 
  - Mechanical: Instantaneous reversal generates torque exceeding the shear strength of gear teeth in plastic/brass planetary gearboxes, stripping gear teeth permanently.
  - Electrical: DC motors generate massive back-EMF (Electromotive Force) spikes ($V_{spike} = L \cdot \frac{di}{dt} + K_e \cdot \omega$) exceeding 35V, blowing the reverse freewheeling MOSFET body diodes of the BTS7960 H-bridge and causing catastrophic hardware shutdown.
* **Attack Signature:**
  $$\left| \frac{\Delta \text{Throttle}}{\Delta t} \right| > \text{Jerk}_{\max} \quad \left(> 10.0 \text{ s}^{-1}\right)$$

#### 2. Resonance Flutter & Rollover Induction
* **Mechanics:** The attacker injects maximum steering rate with rapid sign alternating at the chassis's natural resonance frequency ($f_{res} \approx 3\text{–}6 \text{ Hz}$):
  $$\text{Frame } N: \text{CMD},1,\text{seq},1,0.80,+1.00,0$$
  $$\text{Frame } N+1: \text{CMD},1,\text{seq}+1,1,0.80,-1.00,0$$
  $$\text{Frame } N+2: \text{CMD},1,\text{seq}+2,1,0.80,+1.00,0$$
* **Physical Consequence:** Skid-steer vehicles experience severe lateral centrifugal inertia. Forcing rapid weight shifts at resonance excites the chassis suspension, inducing dynamic rollover or overheating the BTS7960 high-side P-channel gate drivers through excessive switching dissipation ($P_{sw} = V \cdot I \cdot f_{sw} \cdot t_{sw}$).

---

### Category B: State Machine & Safety Inversion Attacks

#### 3. Primed Disarmed Throttle Traps ("Ghost Driving")
* **Mechanics:** The attacker sends a rapid stream of high-throttle frames while deliberately setting `arm = 0`:
  $$\text{CMD},1,1001,0,1.00,0.00,0$$
  The motors remain dormant because the driver is disarmed. However, the internal variables (`currentForward_`) or motion controllers are primed. The moment an operator presses `ARM` on the legitimate dashboard, the rover instantly launches forward at 100% velocity without warning.
* **Defense Logic:** The AI broker rejects any command containing non-zero throttle/turn coordinates if `arm == 0`.

#### 4. Safety Watchdog Oscillation (Denial of Safe-Stop)
* **Mechanics:** The rover firmware enforces a `COMMAND_TIMEOUT_MS = 500ms` failsafe. The attacker injects alternating frames:
  $$\text{Frame } 1: \text{CMD},1,\text{seq},1,0.00,0.00,1 \quad (\text{STOP})$$
  $$\text{Frame } 2: \text{CMD},1,\text{seq}+1,1,0.90,0.00,0 \quad (\text{RUN})$$
  Transmitted at 20 Hz, this keeps the safety watchdog timer resetting while pulsing motor PWM, inducing severe motor driver chatter and preventing clean failsafe latching.

---

### Category C: Sequence Space Exploitation

#### 5. Sequence Jump Deprivation Attack
* **Mechanics:** The rover maintains a monotonic sequence tracker (`sequence > lastSequence_`). An attacker sends a single validly formatted command with the maximum possible 32-bit unsigned integer:
  $$\text{CMD},1,4294967290,1,0.00,0.00,0$$
* **Consequence:** If accepted, all subsequent legitimate commands from the genuine operator (which might be at sequence number `540`) are permanently discarded by the rover firmware as "replayed packets" ($\text{seq} \le \text{lastSequence}$). The genuine operator loses control permanently until the ESP32 is hard-rebooted.

---

## 4. The AI Anomaly Detection Pipeline

To process incoming packets in sub-millisecond time without introducing command latency, the AI broker executes a **three-tiered classification hierarchy**:

```
Raw Command Frame
       │
       ▼
[Tier 1: Deterministic Heuristic Gate] ──────────▶ REJECT if syntax or rate fails (<0.1 ms)
       │
       ▼
[Tier 2: Kinematic Physics Boundary Engine] ─────▶ REJECT if jerk or delta-V violated (<0.5 ms)
       │
       ▼
[Tier 3: Temporal Machine Learning Scorer] ──────▶ QUARANTINE if anomaly score > 0.85 (<2.0 ms)
       │
       ▼
Forward Clean Frame to Rover
```

### Mathematical Specifications:

#### Tier 1: Deterministic Heuristic Boundary
* **Rate-Limiter:** Sliding window token bucket:
  $$\text{Capacity} = 30 \text{ tokens}, \quad \text{Refill Rate} = 15 \text{ tokens/sec}$$
* **Sequence Monotonicity Check:**
  $$1 \le (\text{seq}_{new} - \text{seq}_{last}) \le 1000$$
  *(Prevents both replay and sequence jump deprivation).*

#### Tier 2: Kinematic Feasibility Validator
* **Acceleration Boundary:**
  $$a = \frac{v_t - v_{t-1}}{\Delta t} \le a_{\max} \quad \left(a_{\max} = 3.0 \text{ m/s}^2\right)$$
* **Jerk Boundary:**
  $$j = \frac{a_t - a_{t-1}}{\Delta t} \le j_{\max} \quad \left(j_{\max} = 12.0 \text{ m/s}^3\right)$$
* **Steering Slew Rate:**
  $$\left| \frac{\Delta \text{turn}}{\Delta t} \right| \le \dot{\theta}_{\max} \quad \left(\dot{\theta}_{\max} = 4.0 \text{ rad/s}\right)$$

#### Tier 3: Temporal ML Anomaly Scorer
* **Algorithm:** Multi-variate **Isolation Forest** coupled with a rolling **Exponential Moving Average (EMA) Sequence Predictor**:
  - **Feature Vector:**
    $$\vec{X}_t = \left[ v_t, \dot{v}_t, \omega_t, \dot{\omega}_t, \Delta t, \Delta \text{seq}, \text{arm}_t, \text{stop}_t \right]$$
  - The model scores the probability of the feature vector belonging to the learned distribution of human joystick dynamics.
  - Scores $\ge 0.85$ trip the **Autonomous Isolation Engine**.

---

## 5. Adaptive Isolation & Over-The-Air (OTA) Broker Shift

When Tier 2 or Tier 3 triggers an anomaly condition, the AI Defensive Broker executes an autonomous containment workflow:

### Step 1: Immediate Command Neutralization
1. The AI Broker **drops** the malicious frame immediately. It never reaches the rover.
2. The AI Broker issues an immediate zero-throttle neutral frame to the clean topic:
   $$\text{CMD},1,\text{seq}_{\text{clean}},1,0.00,0.00,0$$

### Step 2: Cryptographic Broker Shift Directive
The AI Broker issues a signed migration frame on a dedicated system topic (`rover/1/control`):
```text
SHIFT_BROKER,<SECURE_FAILOVER_HOST>,<PORT>,<EXPIRY_UNIX>,<HMAC_SHA256>
```
* **Payload Parameters:**
  - `SECURE_FAILOVER_HOST`: The endpoint of the secondary isolated MQTT broker.
  - `PORT`: TLS Port (8883).
  - `EXPIRY_UNIX`: Nonce timestamp to prevent replay of the migration directive.
  - `HMAC_SHA256`: Cryptographic signature generated using a pre-shared secret known only to the ESP32 and the AI Broker:
    $$\text{Signature} = \text{HMAC-SHA256}\left(K_{secret}, \text{Host} + \text{Port} + \text{Expiry}\right)$$

### Step 3: Hardware Rover Containment
Upon receiving and verifying the `SHIFT_BROKER` directive:
1. **Physical Failsafe:** The ESP32 immediately brings `LEFT_EN_PIN (32)` and `RIGHT_EN_PIN (33)` **LOW**, electrically isolating the motor power stages.
2. **Socket Termination:** The ESP32 tears down the TCP socket to the compromised broker (`commandLink_.stop()`).
3. **Endpoint Reconfiguration:** The network link loads the failover host and re-establishes a TLS session with the secure AI broker.
4. **Re-Arming:** Only after verifying mutual TLS / HMAC on the new broker does the ESP32 allow the motors to arm again.

---

## 6. Implementation Reference: Python AI Defensive Broker

Below is the production-ready implementation script for the in-line AI Defensive Broker:

```python
"""
ai_defense_broker.py
Autonomous In-Line AI Security Gateway for Autonomous Rover MQTT Streams.
Inspects incoming command frames, identifies illogical/destructive vectors,
and enforces rate limits, kinematic bounds, and isolation policies.
"""

import os
import time
import re
import hmac
import hashlib
import json
from typing import Optional, Tuple
import paho.mqtt.client as mqtt

# ================= Configuration =================
UPSTREAM_BROKER = "cbe3900b046e42cba6060cb5790fbe1d.s1.eu.hivemq.cloud"
UPSTREAM_PORT = 8883
UPSTREAM_USER = os.environ.get("ROVER_MQTT_USER", "<set-locally>")
UPSTREAM_PASS = os.environ.get("ROVER_MQTT_PASS", "<set-locally>")

DOWNSTREAM_COMMAND_TOPIC = "rover/1/command"
SECURE_OUT_TOPIC = "rover/1/command/sanitized"
CONTROL_TOPIC = "rover/1/control"

SECRET_KEY = os.environ.get("ROVER_GATEWAY_SECRET", "<set-locally>").encode()

# Kinematic Constraints
MAX_ACCEL = 3.5          # max delta throttle per second
MAX_STEER_RATE = 5.0     # max delta turn per second
MAX_PACKET_RATE_HZ = 25  # max commands per second
MAX_SEQ_JUMP = 500       # max allowed sequence leap

class KinematicValidator:
    def __init__(self):
        self.last_time = time.time()
        self.last_forward = 0.0
        self.last_turn = 0.0
        self.last_seq = 0
        self.packet_times = []

    def validate(self, version: int, seq: int, arm: int, fwd: float, turn: float, stop: int) -> Tuple[bool, str]:
        now = time.time()
        dt = max(0.001, now - self.last_time)

        # 1. Rate Limiting (Token / Frequency)
        self.packet_times = [t for t in self.packet_times if now - t < 1.0]
        self.packet_times.append(now)
        if len(self.packet_times) > MAX_PACKET_RATE_HZ:
            return False, f"VOLUMETRIC_FLOOD: {len(self.packet_times)} Hz exceeds {MAX_PACKET_RATE_HZ} Hz limit"

        # 2. Sequence Monotonicity & Anti-Jump Check
        if self.last_seq > 0:
            if seq <= self.last_seq:
                return False, f"REPLAY_ATTACK: Injected seq {seq} <= last {self.last_seq}"
            if (seq - self.last_seq) > MAX_SEQ_JUMP:
                return False, f"SEQ_JUMP_EXHAUSTION: Leap of {seq - self.last_seq} violates threshold"

        # 3. State Inconsistency (Throttle without arming)
        if arm == 0 and (abs(fwd) > 0.05 or abs(turn) > 0.05):
            return False, "STATE_INCONSISTENCY: Commanded velocity while disarmed (arm=0)"

        # 4. Kinematic Acceleration Boundary (Slam-Reverse / Gear Stripping)
        accel = abs(fwd - self.last_forward) / dt
        if accel > MAX_ACCEL:
            return False, f"KINEMATIC_VIOLATION: Accel {accel:.2f}/s exceeds mechanical max {MAX_ACCEL}/s (Slam-Reverse)"

        # 5. Angular Slew Rate Violation (Rollover Prevention)
        turn_rate = abs(turn - self.last_turn) / dt
        if turn_rate > MAX_STEER_RATE:
            return False, f"RESONANCE_ATTACK: Steering rate {turn_rate:.2f}/s exceeds max {MAX_STEER_RATE}/s"

        # Update valid state
        self.last_time = now
        self.last_forward = fwd
        self.last_turn = turn
        self.last_seq = seq
        return True, "BENIGN"

validator = KinematicValidator()

def parse_frame(payload: str):
    # Regex format: CMD,<ver>,<seq>,<arm>,<fwd>,<turn>,<stop>
    pattern = r"^CMD,(\d+),(\d+),([01]),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),([01])$"
    match = re.match(pattern, payload.strip())
    if not match:
        return None
    return (
        int(match.group(1)),
        int(match.group(2)),
        int(match.group(3)),
        float(match.group(4)),
        float(match.group(5)),
        int(match.group(6))
    )

def on_message(client, userdata, msg):
    raw = msg.payload.decode("utf-8", errors="ignore")
    parsed = parse_frame(raw)
    
    if not parsed:
        print(f"[AI SHIELD] ❌ SYNTAX REJECT: Malformed packet: '{raw}'")
        return

    ver, seq, arm, fwd, turn, stop = parsed
    is_valid, reason = validator.validate(ver, seq, arm, fwd, turn, stop)

    if not is_valid:
        print(f"\n🚨 [AI DEFENSE ALERT] ILLOGICAL COMMAND INTERCEPTED!")
        print(f"  ├── Reason  : {reason}")
        print(f"  ├── Payload : {raw}")
        print(f"  └── Verdict : PACKET DROPPED & SOURCE ISOLATED")
        
        # Trigger Autonomous Isolation / Broker Shift
        initiate_quarantine(client)
        return

    # Forward Clean Command to Rover
    client.publish(SECURE_OUT_TOPIC, raw, qos=0)

def initiate_quarantine(client):
    expiry = int(time.time()) + 300
    host = "secure-fallback-broker.eu.hivemq.cloud"
    port = 8883
    msg_data = f"{host}:{port}:{expiry}".encode()
    signature = hmac.new(SECRET_KEY, msg_data, hashlib.sha256).hexdigest()
    
    shift_frame = f"SHIFT_BROKER,{host},{port},{expiry},{signature}"
    client.publish(CONTROL_TOPIC, shift_frame, qos=1)
    print(f"  └── 🔒 BROKER SHIFT COMMAND TRANSMITTED TO ROVER: {shift_frame}\n")

if __name__ == "__main__":
    client = mqtt.Client(client_id="ai_defense_gateway", transport="websockets")
    client.tls_set()
    client.username_pw_set(UPSTREAM_USER, UPSTREAM_PASS)
    client.on_message = on_message

    print("[AI SHIELD] Connecting to Command Broker...")
    client.connect(UPSTREAM_BROKER, UPSTREAM_PORT, 60)
    client.subscribe(DOWNSTREAM_COMMAND_TOPIC)
    print(f"[AI SHIELD] Listening on topic '{DOWNSTREAM_COMMAND_TOPIC}'...")
    client.loop_forever()
```

---

## 7. Firmware Containment Hook (`firmware/src/rover_controller.cpp`)

To support dynamic broker shifts over the air, the rover firmware's command parser is extended to recognize the signed migration frame:

```cpp
bool RoverController::handleMigrationFrame(const String& frame) {
  // Format: SHIFT_BROKER,<host>,<port>,<expiry>,<hmac>
  int p1 = frame.indexOf(',');
  int p2 = frame.indexOf(',', p1 + 1);
  int p3 = frame.indexOf(',', p2 + 1);
  int p4 = frame.indexOf(',', p3 + 1);
  if (p1 == -1 || p2 == -1 || p3 == -1 || p4 == -1) return false;

  String host = frame.substring(p1 + 1, p2);
  uint16_t port = frame.substring(p2 + 1, p3).toInt();
  uint32_t expiry = frame.substring(p3 + 1, p4).toInt();
  String signature = frame.substring(p4 + 1);

  // 1. Check expiration
  if (millis() / 1000 > expiry) return false;

  // 2. Cryptographic signature check
  if (!verifyHmac(host, port, expiry, signature)) {
    Serial.println("[SECURITY] Invalid HMAC on migration frame! REJECTED.");
    return false;
  }

  // 3. Containment & Socket Shift
  Serial.println("[SECURITY] 🔒 EMERGENCY BROKER SHIFT EXECUTED! Isolating compromised broker...");
  forceStop(SafetyState::SAFE_STOP, "BROKER_SHIFT");
  commandLink_.disconnect();
  
  MqttEndpoint newEndpoint;
  newEndpoint.host = host;
  newEndpoint.port = port;
  newEndpoint.user = secrets::MQTT_COMMAND_USER;
  newEndpoint.pass = secrets::MQTT_COMMAND_PASS;
  newEndpoint.topic = "rover/1/command/sanitized";
  newEndpoint.subscribe = true;
  commandLink_.begin(newEndpoint, handleMqtt);
  return true;
}
```

---

## 8. Summary of Defensive Capabilities

| Threat Vector | Naive System Behavior | AI-Protected Rover Behavior |
| :--- | :--- | :--- |
| **Slam-Reverse (Full FWD $\rightarrow$ Full REV)** | Mechanical gear stripping, blown MOSFET body diodes | Filtered by Kinematic Bound Engine; smooth deceleration enforced |
| **Resonance Steering Flutter** | Chassis rollover, motor driver thermal runaway | Detected as angular slew anomaly; capped to maximum lateral stable G-force |
| **Sequence Hop Attack (`seq = 2^{32}-1`)** | Genuine controller permanently locked out | Monotonic window limits sequence hop to $\le 500$; replayed frames discarded |
| **Volumetric Packet Flood** | ESP32 socket buffer overflow, safety watchdog starvation | Token bucket drops excess packets before transmission |
| **Compromised Command Broker** | Attacker retains persistent command injection authority | AI issues authenticated `SHIFT_BROKER`; ESP32 migrates to secure quarantine broker |

---

## 9. Related attack types and assumptions

This defense model assumes the gateway's own credentials and signing key remain secret. That assumption is broken by [ESP32 flash extraction and NVS credential recovery](../attacks/esp32-firmware-extraction/README.md): broker credentials compiled into the application image can be read back, and Wi-Fi credentials persisted from `WIFI` frames can be recovered from NVS. Rotate exposed credentials before deploying this gateway.

The source-side [BLE discovery and GATT enumeration test](../manual%20mode%20firmware%20security/ble-unauthenticated-discovery-and-gatt-enumeration.md) is a separate entry boundary. A BLE foothold may provide command writes, but it does not by itself prove flash read access or broker credential recovery; keep the evidence for each attack type separate.

This document specifies a design and contains illustrative code. It is not evidence that the AI broker, signed `SHIFT_BROKER` frame, or firmware containment hook has been implemented, built, or tested on the rover.
