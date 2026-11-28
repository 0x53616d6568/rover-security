// The browser bundle of mqtt exposes only a default export; the named
// `connect` export exists only in the Node build and the type definitions.
import mqtt from "mqtt";
import type { MqttClient } from "mqtt";
import type { BleAdapter, LinkStates } from "./types";

// Two independent brokers:
//   telemetry broker: dashboard subscribes only
//   command broker:   dashboard publishes only
// This keeps telemetry credentials from being usable to drive the rover.
const TELEMETRY_URL = readEnv("VITE_MQTT_TELEMETRY_URL");
const TELEMETRY_USER = readEnv("VITE_MQTT_TELEMETRY_USER");
const TELEMETRY_PASS = readEnv("VITE_MQTT_TELEMETRY_PASS");
const TELEMETRY_TOPIC = readEnv("VITE_MQTT_TELEMETRY_TOPIC") || "rover/1/telemetry";

const COMMAND_URL = readEnv("VITE_MQTT_COMMAND_URL");
const COMMAND_USER = readEnv("VITE_MQTT_COMMAND_USER");
const COMMAND_PASS = readEnv("VITE_MQTT_COMMAND_PASS");
const COMMAND_TOPIC = readEnv("VITE_MQTT_COMMAND_TOPIC") || "rover/1/command";

const CLIENT_BASE = `dashboard_${Math.random().toString(16).slice(2, 10)}`;

type LinkKind = "telemetry" | "command";

function readEnv(key: string): string {
  const value = (import.meta.env as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function requireUrl(value: string, label: string, key: string): string {
  if (!value) {
    throw new Error(`${label} broker URL is not configured. Set ${key}.`);
  }
  if (!value.startsWith("wss://") && !value.startsWith("ws://")) {
    throw new Error(`${label} broker URL must use wss:// (or ws:// on localhost).`);
  }
  return value;
}

export class MqttAdapter implements BleAdapter {
  readonly id = "mqtt";
  private telemetryClient: MqttClient | null = null;
  private commandClient: MqttClient | null = null;
  private telemetryConnected = false;
  private commandConnected = false;
  private isConnected = false;
  private statusListeners = new Set<(raw: string, receivedAt: number) => void>();
  private connectionListeners = new Set<
    (connected: boolean, authorized: boolean, receivedAt: number) => void
  >();
  private linkListeners = new Set<(links: LinkStates) => void>();

  isSupported(): boolean {
    return typeof WebSocket !== "undefined";
  }

  supportMessage(): string {
    return "Split MQTT: telemetry and command brokers are configured separately.";
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;

    const telemetryUrl = requireUrl(
      TELEMETRY_URL,
      "Telemetry",
      "VITE_MQTT_TELEMETRY_URL",
    );
    const commandUrl = requireUrl(COMMAND_URL, "Command", "VITE_MQTT_COMMAND_URL");

    this.telemetryConnected = false;
    this.commandConnected = false;
    this.isConnected = false;
    this.emitLinks();

    this.telemetryClient = this.createClient(
      telemetryUrl,
      TELEMETRY_USER,
      TELEMETRY_PASS,
      "telemetry",
    );
    this.commandClient = this.createClient(
      commandUrl,
      COMMAND_USER,
      COMMAND_PASS,
      "command",
    );

    try {
      await Promise.all([
        this.waitForConnect(this.telemetryClient, "Telemetry broker"),
        this.waitForConnect(this.commandClient, "Command broker"),
      ]);
    } catch (error) {
      await this.disconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    const telemetry = this.telemetryClient;
    const command = this.commandClient;
    this.telemetryClient = null;
    this.commandClient = null;
    this.telemetryConnected = false;
    this.commandConnected = false;
    this.isConnected = false;

    telemetry?.end(true);
    command?.end(true);
    this.emitLinks();
    this.emitConnection();
  }

  async writeCommand(frame: string): Promise<void> {
    const client = this.commandClient;
    if (!client || !this.commandConnected) {
      throw new Error("Command broker is not connected.");
    }

    await new Promise<void>((resolve, reject) => {
      client.publish(COMMAND_TOPIC, frame, { qos: 1, retain: false }, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }

  onStatus(listener: (raw: string, receivedAt: number) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onConnection(
    listener: (connected: boolean, authorized: boolean, receivedAt: number) => void,
  ): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onLinks(listener: (links: LinkStates) => void): () => void {
    this.linkListeners.add(listener);
    listener({ telemetry: this.telemetryConnected, command: this.commandConnected });
    return () => this.linkListeners.delete(listener);
  }

  private createClient(
    url: string,
    user: string,
    pass: string,
    kind: LinkKind,
  ): MqttClient {
    const client = mqtt.connect(url, {
      clientId: `${CLIENT_BASE}_${kind}`,
      username: user || undefined,
      password: pass || undefined,
      clean: true,
      connectTimeout: 8000,
      reconnectPeriod: 3000,
      keepalive: 30,
    });

    client.on("connect", () => {
      if (kind === "telemetry") {
        client.subscribe(TELEMETRY_TOPIC, { qos: 1 }, (error) => {
          if (error) console.error("[MQTT] Telemetry subscribe error:", error);
        });
      }
      this.setLinkState(kind, true);
    });

    client.on("close", () => this.setLinkState(kind, false));
    client.on("offline", () => this.setLinkState(kind, false));
    client.on("error", (error) => {
      console.error(`[MQTT] ${kind} broker error:`, error);
    });

    if (kind === "telemetry") {
      client.on("message", (topic, payload) => {
        if (topic !== TELEMETRY_TOPIC) return;
        const raw = payload.toString();
        this.statusListeners.forEach((listener) => listener(raw, Date.now()));
      });
    }

    return client;
  }

  private waitForConnect(client: MqttClient, label: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (client.connected) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`${label} connection timed out.`));
      }, 12000);

      const onConnect = () => {
        cleanup();
        resolve();
      };
      const onError = (error: Error) => {
        cleanup();
        reject(new Error(`${label}: ${error.message}`));
      };
      const cleanup = () => {
        clearTimeout(timer);
        client.off("connect", onConnect);
        client.off("error", onError);
      };

      client.once("connect", onConnect);
      client.once("error", onError);
    });
  }

  private setLinkState(kind: LinkKind, connected: boolean): void {
    if (kind === "telemetry") this.telemetryConnected = connected;
    else this.commandConnected = connected;

    this.isConnected = this.telemetryConnected && this.commandConnected;
    this.emitLinks();
    this.emitConnection();
  }

  private emitLinks(): void {
    const links: LinkStates = {
      telemetry: this.telemetryConnected,
      command: this.commandConnected,
    };
    this.linkListeners.forEach((listener) => listener(links));
  }

  private emitConnection(): void {
    const now = Date.now();
    // Only the command link authorizes motion; telemetry is read-only.
    this.connectionListeners.forEach((listener) =>
      listener(this.isConnected, this.commandConnected, now),
    );
  }
}
