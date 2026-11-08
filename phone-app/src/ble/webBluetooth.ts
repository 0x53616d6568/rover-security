import type { BleAdapter, LinkStates } from "./types";

const SERVICE_UUID = "8f4d0001-4f4b-4e49-9e4f-454e49534f01";
const COMMAND_UUID = "8f4d0002-4f4b-4e49-9e4f-454e49534f01";
const STATUS_UUID = "8f4d0003-4f4b-4e49-9e4f-454e49534f01";

interface BluetoothDeviceLike {
  gatt?: {
    connect(): Promise<BluetoothRemoteGATTServerLike>;
    disconnect(): void;
    connected: boolean;
  };
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

interface BluetoothRemoteGATTServerLike {
  getPrimaryService(uuid: string): Promise<BluetoothRemoteGATTServiceLike>;
  disconnect(): void;
  connected: boolean;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic(uuid: string): Promise<BluetoothRemoteGATTCharacteristicLike>;
}

interface BluetoothRemoteGATTCharacteristicLike {
  writeValueWithoutResponse?(value: BufferSource): Promise<void>;
  writeValue(value: BufferSource): Promise<void>;
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristicLike>;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  value?: DataView | null;
}

export class WebBluetoothAdapter implements BleAdapter {
  readonly id = "web-bluetooth";

  private device: BluetoothDeviceLike | null = null;
  private server: BluetoothRemoteGATTServerLike | null = null;
  private commandCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private statusCharacteristic: BluetoothRemoteGATTCharacteristicLike | null = null;
  private statusListeners = new Set<(raw: string, receivedAt: number) => void>();
  private connectionListeners = new Set<(connected: boolean, authorized: boolean, receivedAt: number) => void>();
  private linkListeners = new Set<(links: LinkStates) => void>();
  private statusHandler: ((event: Event) => void) | null = null;
  private disconnectHandler: ((event: Event) => void) | null = null;

  isSupported(): boolean {
    return typeof navigator !== "undefined" && "bluetooth" in navigator;
  }

  supportMessage(): string {
    if (this.isSupported()) return "Web Bluetooth available.";
    return "This browser does not support Web Bluetooth. Use a Chromium-based browser over HTTPS or localhost.";
  }

  async connect(): Promise<void> {
    if (!this.isSupported()) throw new Error(this.supportMessage());

    const bluetooth = (navigator as Navigator & { bluetooth?: { requestDevice: (options: unknown) => Promise<BluetoothDeviceLike> } }).bluetooth;
    if (!bluetooth) throw new Error(this.supportMessage());

    this.device = await bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }],
      optionalServices: [SERVICE_UUID],
    });

    this.disconnectHandler = () => {
      this.server = null;
      this.commandCharacteristic = null;
      this.statusCharacteristic = null;
      const now = Date.now();
      for (const listener of this.connectionListeners) listener(false, false, now);
      this.emitLinks(false);
    };
    this.device.addEventListener("gattserverdisconnected", this.disconnectHandler);

    this.server = await this.device.gatt!.connect();
    const service = await this.server.getPrimaryService(SERVICE_UUID);
    this.commandCharacteristic = await service.getCharacteristic(COMMAND_UUID);
    this.statusCharacteristic = await service.getCharacteristic(STATUS_UUID);

    this.statusHandler = (event: Event) => {
      const target = event.target as unknown as BluetoothRemoteGATTCharacteristicLike;
      const value = target.value;
      if (!value) return;
      // GATT notifications may be backed by a larger shared buffer, so honour
      // the DataView window instead of decoding the whole ArrayBuffer.
      const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
      const text = new TextDecoder().decode(bytes);
      const now = Date.now();
      for (const listener of this.statusListeners) listener(text, now);
    };
    this.statusCharacteristic.addEventListener("characteristicvaluechanged", this.statusHandler);
    await this.statusCharacteristic.startNotifications();

    const now = Date.now();
    for (const listener of this.connectionListeners) listener(true, true, now);
    this.emitLinks(true);
  }

  async disconnect(): Promise<void> {
    try {
      await this.statusCharacteristic?.stopNotifications();
    } catch {
      // Ignore stop errors during teardown.
    }
    if (this.statusCharacteristic && this.statusHandler) {
      this.statusCharacteristic.removeEventListener("characteristicvaluechanged", this.statusHandler);
    }
    if (this.device && this.disconnectHandler) {
      this.device.removeEventListener("gattserverdisconnected", this.disconnectHandler);
    }
    this.server?.disconnect();
    this.server = null;
    this.commandCharacteristic = null;
    this.statusCharacteristic = null;
    this.device = null;
    const now = Date.now();
    for (const listener of this.connectionListeners) listener(false, false, now);
    this.emitLinks(false);
  }

  async writeCommand(frame: string): Promise<void> {
    if (!this.commandCharacteristic) throw new Error("Not connected.");
    const data = new TextEncoder().encode(frame);
    if (this.commandCharacteristic.writeValueWithoutResponse) {
      await this.commandCharacteristic.writeValueWithoutResponse(data);
    } else {
      await this.commandCharacteristic.writeValue(data);
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

  onLinks(listener: (links: LinkStates) => void): () => void {
    this.linkListeners.add(listener);
    listener({ telemetry: this.commandCharacteristic !== null, command: this.commandCharacteristic !== null });
    return () => this.linkListeners.delete(listener);
  }

  private emitLinks(connected: boolean): void {
    const links: LinkStates = { telemetry: connected, command: connected };
    for (const listener of this.linkListeners) listener(links);
  }
}