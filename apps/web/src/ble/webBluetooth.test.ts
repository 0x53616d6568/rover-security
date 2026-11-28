import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WebBluetoothAdapter } from "./webBluetooth";

const SERVICE_UUID = "8f4d0001-4f4b-4e49-9e4f-454e49534f01";
const COMMAND_UUID = "8f4d0002-4f4b-4e49-9e4f-454e49534f01";
const STATUS_UUID = "8f4d0003-4f4b-4e49-9e4f-454e49534f01";

type EventListener = (event: Event) => void;

function buildMock({ withWriteWithoutResponse = true } = {}) {
  const statusListeners = new Set<EventListener>();
  const deviceListeners = new Set<EventListener>();
  const serviceRequests: string[] = [];

  const statusCharacteristic = {
    value: null as DataView | null,
    startNotifications: vi.fn(async () => undefined),
    stopNotifications: vi.fn(async () => undefined),
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "characteristicvaluechanged") statusListeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "characteristicvaluechanged") statusListeners.delete(listener);
    }),
  };

  const commandCharacteristic: Record<string, unknown> = {
    writeValue: vi.fn(async () => undefined),
  };
  if (withWriteWithoutResponse) {
    commandCharacteristic.writeValueWithoutResponse = vi.fn(async () => undefined);
  }

  const server = {
    connected: true,
    getPrimaryService: vi.fn(async (uuid: string) => {
      serviceRequests.push(uuid);
      return {
        getCharacteristic: vi.fn(async (characteristicUuid: string) => {
          if (characteristicUuid === COMMAND_UUID) return commandCharacteristic;
          if (characteristicUuid === STATUS_UUID) return statusCharacteristic;
          throw new Error(`Unexpected characteristic ${characteristicUuid}`);
        }),
      };
    }),
    disconnect: vi.fn(),
  };

  const device = {
    gatt: {
      connected: false,
      connect: vi.fn(async () => server),
      disconnect: vi.fn(),
    },
    addEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "gattserverdisconnected") deviceListeners.add(listener);
    }),
    removeEventListener: vi.fn((type: string, listener: EventListener) => {
      if (type === "gattserverdisconnected") deviceListeners.delete(listener);
    }),
  };

  const bluetooth = {
    requestDevice: vi.fn(async () => device),
  };

  const emitStatus = (text: string, offset = 0, padding = 0) => {
    const encoded = new TextEncoder().encode(text);
    const buffer = new ArrayBuffer(offset + encoded.length + padding);
    if (offset > 0) new Uint8Array(buffer, 0, offset).fill(0x41);
    new Uint8Array(buffer, offset, encoded.length).set(encoded);
    if (padding > 0) {
      new Uint8Array(buffer, offset + encoded.length, padding).fill(0x42);
    }
    statusCharacteristic.value = new DataView(buffer, offset, encoded.length);
    for (const listener of statusListeners) {
      listener({ target: statusCharacteristic } as unknown as Event);
    }
  };

  const emitStatusEvent = () => {
    for (const listener of statusListeners) {
      listener({ target: statusCharacteristic } as unknown as Event);
    }
  };

  const emitGattDisconnect = () => {
    for (const listener of deviceListeners) listener({} as Event);
  };

  return {
    bluetooth,
    device,
    server,
    commandCharacteristic,
    statusCharacteristic,
    serviceRequests,
    emitStatus,
    emitStatusEvent,
    emitGattDisconnect,
  };
}

function installBluetooth(value: unknown) {
  Object.defineProperty(navigator, "bluetooth", {
    configurable: true,
    value,
  });
}

describe("WebBluetoothAdapter", () => {
  afterEach(() => {
    delete (navigator as Navigator & { bluetooth?: unknown }).bluetooth;
  });

  describe("support detection", () => {
    it("reports support based on navigator.bluetooth", () => {
      installBluetooth({ requestDevice: vi.fn() });
      const adapter = new WebBluetoothAdapter();
      expect(adapter.isSupported()).toBe(true);
      expect(adapter.supportMessage()).toContain("available");
    });

    it("explains how to run without Web Bluetooth", () => {
      const adapter = new WebBluetoothAdapter();
      expect(adapter.isSupported()).toBe(false);
      expect(adapter.supportMessage()).toContain("Chromium");
    });

    it("refuses to connect without Web Bluetooth", async () => {
      const adapter = new WebBluetoothAdapter();
      await expect(adapter.connect()).rejects.toThrow("Web Bluetooth");
    });
  });

  describe("connect", () => {
    let mock: ReturnType<typeof buildMock>;

    beforeEach(() => {
      mock = buildMock();
      installBluetooth(mock.bluetooth);
    });

    it("requests the rover service and wires the GATT characteristics", async () => {
      const adapter = new WebBluetoothAdapter();
      await adapter.connect();

      expect(mock.bluetooth.requestDevice).toHaveBeenCalledWith({
        filters: [{ services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
      expect(mock.device.gatt.connect).toHaveBeenCalledTimes(1);
      expect(mock.serviceRequests).toEqual([SERVICE_UUID]);
      expect(mock.statusCharacteristic.startNotifications).toHaveBeenCalledTimes(1);
      expect(mock.statusCharacteristic.addEventListener).toHaveBeenCalledWith(
        "characteristicvaluechanged",
        expect.any(Function),
      );
      expect(mock.device.addEventListener).toHaveBeenCalledWith(
        "gattserverdisconnected",
        expect.any(Function),
      );
    });

    it("notifies connection listeners once the link is ready", async () => {
      const adapter = new WebBluetoothAdapter();
      const events: Array<{ connected: boolean; authorized: boolean }> = [];
      adapter.onConnection((connected, authorized) => events.push({ connected, authorized }));

      await adapter.connect();

      expect(events).toEqual([{ connected: true, authorized: true }]);
    });

    it("surfaces requestDevice failures", async () => {
      mock.bluetooth.requestDevice.mockRejectedValueOnce(new Error("User cancelled"));
      const adapter = new WebBluetoothAdapter();
      await expect(adapter.connect()).rejects.toThrow("User cancelled");
    });

    it("surfaces a missing GATT server instead of pretending to connect", async () => {
      mock.device.gatt.connect.mockRejectedValueOnce(new Error("GATT connect failed"));
      const adapter = new WebBluetoothAdapter();
      const events: boolean[] = [];
      adapter.onConnection((connected) => events.push(connected));

      await expect(adapter.connect()).rejects.toThrow("GATT connect failed");
      expect(events).toEqual([]);
    });
  });

  describe("status notifications", () => {
    it("decodes exactly the DataView window", async () => {
      const mock = buildMock();
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();
      const frames: string[] = [];
      adapter.onStatus((raw) => frames.push(raw));
      await adapter.connect();

      mock.emitStatus("STATE=MANUAL;SEQ=4", 3, 5);
      expect(frames).toEqual(["STATE=MANUAL;SEQ=4"]);

      await adapter.disconnect();
    });

    it("ignores notifications without a value", async () => {
      const mock = buildMock();
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();
      const frames: string[] = [];
      adapter.onStatus((raw) => frames.push(raw));
      await adapter.connect();

      mock.statusCharacteristic.value = null;
      mock.emitStatusEvent();
      expect(frames).toEqual([]);

      await adapter.disconnect();
    });

    it("supports listener unsubscribe", async () => {
      const mock = buildMock();
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();
      const frames: string[] = [];
      const unsubscribe = adapter.onStatus((raw) => frames.push(raw));
      await adapter.connect();

      unsubscribe();
      mock.emitStatus("STATE=DISARMED;SEQ=1");
      expect(frames).toEqual([]);

      await adapter.disconnect();
    });
  });

  describe("commands and teardown", () => {
    it("writes frames without response when the rover supports it", async () => {
      const mock = buildMock();
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();
      await adapter.connect();

      await adapter.writeCommand("CMD,1,1,1,0.500,0.000,0");

      expect(mock.commandCharacteristic.writeValueWithoutResponse).toHaveBeenCalledTimes(1);
      const written = (mock.commandCharacteristic.writeValueWithoutResponse as ReturnType<
        typeof vi.fn
      >).mock.calls[0][0] as Uint8Array;
      expect(new TextDecoder().decode(written)).toBe("CMD,1,1,1,0.500,0.000,0");
    });

    it("falls back to an acknowledged write", async () => {
      const mock = buildMock({ withWriteWithoutResponse: false });
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();
      await adapter.connect();

      await adapter.writeCommand("CMD,1,2,0,0.000,0.000,1");

      expect(mock.commandCharacteristic.writeValue).toHaveBeenCalledTimes(1);
    });

    it("rejects writes while disconnected", async () => {
      const mock = buildMock();
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();

      await expect(adapter.writeCommand("CMD,1,1,0,0,0,1")).rejects.toThrow("Not connected");
      expect(mock.commandCharacteristic.writeValue).not.toHaveBeenCalled();
    });

    it("tears down notifications and reports the loss of the link", async () => {
      const mock = buildMock();
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();
      const events: Array<{ connected: boolean; authorized: boolean }> = [];
      adapter.onConnection((connected, authorized) => events.push({ connected, authorized }));

      await adapter.connect();
      await adapter.disconnect();

      expect(mock.statusCharacteristic.stopNotifications).toHaveBeenCalledTimes(1);
      expect(mock.statusCharacteristic.removeEventListener).toHaveBeenCalledWith(
        "characteristicvaluechanged",
        expect.any(Function),
      );
      expect(mock.device.removeEventListener).toHaveBeenCalledWith(
        "gattserverdisconnected",
        expect.any(Function),
      );
      expect(mock.server.disconnect).toHaveBeenCalledTimes(1);
      expect(events).toEqual([
        { connected: true, authorized: true },
        { connected: false, authorized: false },
      ]);
      await expect(adapter.writeCommand("CMD,1,3,0,0,0,1")).rejects.toThrow("Not connected");
    });

    it("reports a GATT-initiated disconnection and blocks further commands", async () => {
      const mock = buildMock();
      installBluetooth(mock.bluetooth);
      const adapter = new WebBluetoothAdapter();
      const events: boolean[] = [];
      adapter.onConnection((connected) => events.push(connected));

      await adapter.connect();
      mock.emitGattDisconnect();

      expect(events).toEqual([true, false]);
      await expect(adapter.writeCommand("CMD,1,3,0,0,0,1")).rejects.toThrow("Not connected");
    });
  });
});
