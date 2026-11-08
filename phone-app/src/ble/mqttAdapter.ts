import mqtt from "mqtt";
import type { BleAdapter } from "./types";

const MQTT_URL = "wss://dd4bee3682e2479fbe315b7d4670285f.s1.eu.hivemq.cloud:8884/mqtt";
const MQTT_USER = "majdgha";
const MQTT_PASS = "552003Ssl";
const TELEMETRY_TOPIC = "drone/1/telemetry";
const COMMAND_TOPIC = "drone/1/command";

export class MqttAdapter implements BleAdapter {
  readonly id = "mqtt";
  private client: mqtt.MqttClient | null = null;
  private statusListeners = new Set<(raw: string, receivedAt: number) => void>();
  private connectionListeners = new Set<(connected: boolean, authorized: boolean, receivedAt: number) => void>();
  private isConnected = false;

  isSupported(): boolean {
    return typeof WebSocket !== "undefined";
  }

  supportMessage(): string {
    return "MQTT over WebSockets supported.";
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    return new Promise((resolve, reject) => {
      try {
        const client = mqtt.connect(MQTT_URL, {
          username: MQTT_USER,
          password: MQTT_PASS,
          protocol: "wss",
          port: 8884,
          clean: true,
          connectTimeout: 8000,
          reconnectPeriod: 3000,
        });

        client.on("connect", () => {
          this.isConnected = true;
          client.subscribe(TELEMETRY_TOPIC, (err) => {
            if (err) console.error("[MQTT] Subscribe error:", err);
          });
          this.connectionListeners.forEach((l) => l(true, true, Date.now()));
          resolve();
        });

        client.on("message", (topic, payload) => {
          if (topic === TELEMETRY_TOPIC) {
            const raw = payload.toString();
            this.statusListeners.forEach((l) => l(raw, Date.now()));
          }
        });

        client.on("error", (err) => {
          console.error("[MQTT] Error:", err);
        });

        client.on("close", () => {
          this.isConnected = false;
          this.connectionListeners.forEach((l) => l(false, false, Date.now()));
        });

        this.client = client;
      } catch (err) {
        reject(err);
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.isConnected = false;
      this.connectionListeners.forEach((l) => l(false, false, Date.now()));
    }
  }

  async writeCommand(frame: string): Promise<void> {
    if (this.client && this.isConnected) {
      this.client.publish(COMMAND_TOPIC, frame);
    }
  }

  onStatus(listener: (raw: string, receivedAt: number) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onConnection(listener: (connected: boolean, authorized: boolean, receivedAt: number) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }
}
