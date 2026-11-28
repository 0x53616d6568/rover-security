import type { BleAdapter, LinkStates } from "./types";

export class DemoAdapter implements BleAdapter {
  readonly id = "demo";

  private statusListeners = new Set<(raw: string, receivedAt: number) => void>();
  private connectionListeners = new Set<(connected: boolean, authorized: boolean, receivedAt: number) => void>();
  private linkListeners = new Set<(links: LinkStates) => void>();
  private connected = false;
  private safetyState = "DISARMED";
  private lastSequence = 0;
  private hasSequence = false;
  private timer: number | null = null;

  isSupported(): boolean {
    return true;
  }

  supportMessage(): string {
    return "Demo mode simulates a rover. Values are labelled as simulated.";
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    this.connected = true;
    const now = Date.now();
    for (const listener of this.connectionListeners) listener(true, true, now);
    this.emitLinks();
    this.emit(`STATE=${this.safetyState};EVENT=CONNECTED_REARM_REQUIRED;SEQ=${this.lastSequence};VALID=1;SENSOR_DATA=SIMULATED;AGE_MS=0;GPS=Tunis, Tunisia;GPS_VALIDITY=simulated`);
    this.timer = window.setInterval(() => {
      if (!this.connected) return;
      this.emit(`STATE=${this.safetyState};SEQ=${this.lastSequence};VALID=1;SENSOR_DATA=SIMULATED;AGE_MS=0;GPS=Tunis, Tunisia;GPS_VALIDITY=simulated`);
    }, 500);
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const now = Date.now();
    for (const listener of this.connectionListeners) listener(false, false, now);
    this.emitLinks();
    this.safetyState = "DISARMED";
  }

  async writeCommand(frame: string): Promise<void> {
    if (!this.connected) throw new Error("Not connected.");

    const parts = frame.trim().split(",");
    const unsigned = (token: string): number | null =>
      /^\d+$/.test(token) ? Number(token) : null;
    const axis = (token: string): number | null => {
      const parsed = Number(token);
      return token.trim() !== "" && Number.isFinite(parsed) ? parsed : null;
    };

    if (parts[0] === "WIFI") {
      const ssid = (parts[1] ?? "").trim();
      const password = (parts[2] ?? "").trim();
      if (parts.length !== 3 || !ssid || !password) {
        this.reject("WIFI_REJECT");
        return;
      }
      this.safetyState = "DISARMED";
      this.emit(`STATE=DISARMED;EVENT=WIFI_UPDATED;SEQ=${this.lastSequence};VALID=1;SENSOR_DATA=SIMULATED;AGE_MS=0;GPS=Tunis, Tunisia;GPS_VALIDITY=simulated`);
      return;
    }

    if (parts.length !== 7 || parts[0] !== "CMD" || parts[1] !== "1") {
      this.reject("REJECT_FORMAT");
      return;
    }

    const sequence = unsigned(parts[2]);
    const arm = unsigned(parts[3]);
    const forward = axis(parts[4]);
    const turn = axis(parts[5]);
    const stop = unsigned(parts[6]);

    // Mirror firmware validation order: malformed values fail safe before the
    // frame is allowed to disarm or move the rover.
    if (
      sequence === null ||
      sequence > 0xffffffff ||
      arm === null ||
      arm > 1 ||
      forward === null ||
      Math.abs(forward) > 1 ||
      turn === null ||
      Math.abs(turn) > 1 ||
      stop === null ||
      stop > 1
    ) {
      this.reject("REJECT_VALUE");
      return;
    }

    if (this.hasSequence && sequence <= this.lastSequence) {
      this.reject("REJECT_SEQUENCE");
      return;
    }

    this.hasSequence = true;
    this.lastSequence = sequence;

    if (stop === 1 || arm === 0) {
      this.safetyState = "DISARMED";
      this.emit(`STATE=${this.safetyState};EVENT=${stop === 1 ? "STOP" : "DISARM"};SEQ=${sequence};VALID=1;SENSOR_DATA=SIMULATED;AGE_MS=0;GPS=Tunis, Tunisia;GPS_VALIDITY=simulated`);
      return;
    }
    this.safetyState = "MANUAL";
    this.emit(`STATE=${this.safetyState};EVENT=ACCEPTED;SEQ=${sequence};VALID=1;SENSOR_DATA=SIMULATED;AGE_MS=0;GPS=Tunis, Tunisia;GPS_VALIDITY=simulated`);
  }

  private reject(event: string): void {
    this.safetyState = "SAFE_STOP";
    this.emit(`STATE=${this.safetyState};EVENT=${event};SEQ=${this.lastSequence};VALID=1;SENSOR_DATA=SIMULATED;AGE_MS=0;GPS=Tunis, Tunisia;GPS_VALIDITY=simulated`);
  }

  onStatus(listener: (raw: string, receivedAt: number) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onConnection(listener: (connected: boolean, authorized: boolean, receivedAt: number) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  onLinks(listener: (links: LinkStates) => void): () => void {
    this.linkListeners.add(listener);
    listener({ telemetry: this.connected, command: this.connected });
    return () => this.linkListeners.delete(listener);
  }

  private emitLinks(): void {
    const links: LinkStates = { telemetry: this.connected, command: this.connected };
    for (const listener of this.linkListeners) listener(links);
  }

  private emit(raw: string): void {
    const now = Date.now();
    for (const listener of this.statusListeners) listener(raw, now);
  }
}