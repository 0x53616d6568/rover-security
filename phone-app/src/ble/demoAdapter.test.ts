import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseTelemetry } from "../protocol/telemetry";
import { DemoAdapter } from "./demoAdapter";

function collect(adapter: DemoAdapter) {
  const frames: string[] = [];
  const connections: Array<{ connected: boolean; authorized: boolean }> = [];
  const stopStatus = adapter.onStatus((raw) => frames.push(raw));
  const stopConnection = adapter.onConnection((connected, authorized) =>
    connections.push({ connected, authorized }),
  );
  return {
    frames,
    connections,
    latest: () => parseTelemetry(frames.at(-1) ?? ""),
    dispose: () => {
      stopStatus();
      stopConnection();
    },
  };
}

describe("DemoAdapter", () => {
  let adapter: DemoAdapter;

  beforeEach(() => {
    adapter = new DemoAdapter();
  });

  afterEach(() => {
    void adapter.disconnect();
  });

  it("is always available and clearly labels simulated data", () => {
    expect(adapter.isSupported()).toBe(true);
    expect(adapter.supportMessage()).toContain("simulated");
  });

  it("announces an authorized connection that still requires re-arming", async () => {
    const output = collect(adapter);
    await adapter.connect();

    expect(output.connections).toEqual([{ connected: true, authorized: true }]);
    expect(output.latest()?.lastEvent).toBe("CONNECTED_REARM_REQUIRED");
    expect(output.latest()?.safetyState).toBe("DISARMED");
    expect(output.latest()?.sensorData).toBe("simulated");
    expect(output.latest()?.raw.GPS).toBe("Tunis, Tunisia");
    expect(output.latest()?.raw.GPS_VALIDITY).toBe("simulated");
    output.dispose();
  });

  it("arms into MANUAL and acknowledges accepted drive commands", async () => {
    const output = collect(adapter);
    await adapter.connect();

    await adapter.writeCommand("CMD,1,1,1,0.000,0.000,0");
    expect(output.latest()?.safetyState).toBe("MANUAL");
    expect(output.latest()?.lastEvent).toBe("ACCEPTED");

    await adapter.writeCommand("CMD,1,2,1,0.500,-0.500,0");
    expect(output.latest()?.safetyState).toBe("MANUAL");
    expect(output.latest()?.lastEvent).toBe("ACCEPTED");
    expect(output.latest()?.lastSequence).toBe(2);
    output.dispose();
  });

  it("disarms on an arm=0 command and stops on an explicit stop", async () => {
    const output = collect(adapter);
    await adapter.connect();
    await adapter.writeCommand("CMD,1,1,1,0,0,0");

    await adapter.writeCommand("CMD,1,2,0,0,0,0");
    expect(output.latest()?.safetyState).toBe("DISARMED");
    expect(output.latest()?.lastEvent).toBe("DISARM");

    await adapter.writeCommand("CMD,1,3,0,0,0,1");
    expect(output.latest()?.safetyState).toBe("DISARMED");
    expect(output.latest()?.lastEvent).toBe("STOP");
    output.dispose();
  });

  it("rejects malformed frames without silently accepting them", async () => {
    const output = collect(adapter);
    await adapter.connect();

    await adapter.writeCommand("not-a-command");
    expect(output.latest()?.lastEvent).toBe("REJECT_FORMAT");
    expect(output.latest()?.safetyState).toBe("SAFE_STOP");

    await adapter.writeCommand("CMD,1,2,2,0,0,0");
    expect(output.latest()?.lastEvent).toBe("REJECT_VALUE");
    expect(output.latest()?.safetyState).toBe("SAFE_STOP");
    output.dispose();
  });

  it("rejects regressing and non-integer sequences", async () => {
    const output = collect(adapter);
    await adapter.connect();
    await adapter.writeCommand("CMD,1,5,1,0,0,0");
    expect(output.latest()?.safetyState).toBe("MANUAL");

    await adapter.writeCommand("CMD,1,5,1,0,0,0");
    expect(output.latest()?.lastEvent).toBe("REJECT_SEQUENCE");
    expect(output.latest()?.safetyState).toBe("SAFE_STOP");

    await adapter.writeCommand("CMD,1,6.5,1,0,0,0");
    expect(output.latest()?.lastEvent).toBe("REJECT_VALUE");
    expect(output.latest()?.lastSequence).toBe(5);
    output.dispose();
  });

  it("fails safe when an axis is out of range", async () => {
    const output = collect(adapter);
    await adapter.connect();

    await adapter.writeCommand("CMD,1,1,1,1.500,0,0");
    expect(output.latest()?.safetyState).toBe("SAFE_STOP");
    expect(output.latest()?.lastEvent).toBe("REJECT_VALUE");
    output.dispose();
  });

  it("accepts a WIFI init frame and drops to DISARMED", async () => {
    const output = collect(adapter);
    await adapter.connect();

    await adapter.writeCommand("WIFI,HomeNet,s3cret!");
    expect(output.latest()?.lastEvent).toBe("WIFI_UPDATED");
    expect(output.latest()?.safetyState).toBe("DISARMED");
    output.dispose();
  });

  it("fails safe on a malformed WIFI frame", async () => {
    const output = collect(adapter);
    await adapter.connect();

    await adapter.writeCommand("WIFI,");
    expect(output.latest()?.lastEvent).toBe("WIFI_REJECT");
    expect(output.latest()?.safetyState).toBe("SAFE_STOP");
    output.dispose();
  });

  it("refuses to write while disconnected", async () => {
    await expect(adapter.writeCommand("CMD,1,1,1,0,0,0")).rejects.toThrow("Not connected");
  });

  it("reports the link loss exactly once and ignores duplicate connects", async () => {
    const output = collect(adapter);
    await adapter.connect();
    await adapter.connect();
    expect(output.connections).toHaveLength(1);

    await adapter.disconnect();
    expect(output.connections.at(-1)).toEqual({ connected: false, authorized: false });
    output.dispose();
  });

  it("stops its heartbeat timer on disconnect", async () => {
    vi.useFakeTimers();
    try {
      const output = collect(adapter);
      await adapter.connect();
      const initial = output.frames.length;

      vi.advanceTimersByTime(1_000);
      expect(output.frames.length).toBeGreaterThan(initial);

      await adapter.disconnect();
      const afterDisconnect = output.frames.length;
      vi.advanceTimersByTime(2_000);
      expect(output.frames.length).toBe(afterDisconnect);
      output.dispose();
    } finally {
      vi.useRealTimers();
    }
  });
});
