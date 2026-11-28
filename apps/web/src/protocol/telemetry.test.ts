import { describe, expect, it } from "vitest";

import { formatAge, parseTelemetry } from "./telemetry";

describe("parseTelemetry", () => {
  it("parses a complete firmware report", () => {
    const telemetry = parseTelemetry(
      "STATE=MANUAL;EVENT=ACCEPTED;SEQ=42;VALID=1;SENSOR_DATA=available;AGE_MS=125",
      1_000,
    );

    expect(telemetry).not.toBeNull();
    expect(telemetry?.safetyState).toBe("MANUAL");
    expect(telemetry?.lastEvent).toBe("ACCEPTED");
    expect(telemetry?.lastSequence).toBe(42);
    expect(telemetry?.ageMs).toBe(125);
    expect(telemetry?.sensorData).toBe("available");
    expect(telemetry?.receivedAt).toBe(1_000);
    expect(telemetry?.raw.STATE).toBe("MANUAL");
  });

  it("normalizes keys and values case", () => {
    const telemetry = parseTelemetry(" state = disarmed ; event = heartbeat ");

    expect(telemetry?.safetyState).toBe("DISARMED");
    expect(telemetry?.lastEvent).toBe("heartbeat");
    expect(telemetry?.raw["EVENT"]).toBe("heartbeat");
  });

  it("fails closed to FAULT when the state token is missing or unknown", () => {
    expect(parseTelemetry("VALID=0;SENSOR_DATA=UNAVAILABLE")?.safetyState).toBe("FAULT");
    expect(parseTelemetry("STATE=ARMED")?.safetyState).toBe("FAULT");
  });

  it("returns null for empty frames", () => {
    expect(parseTelemetry("")).toBeNull();
    expect(parseTelemetry("   ")).toBeNull();
  });

  it("prefers an explicit SENSOR_DATA token over the legacy VALID flag", () => {
    expect(parseTelemetry("STATE=MANUAL;SENSOR_DATA=unavailable;VALID=1")?.sensorData).toBe(
      "unavailable",
    );
    expect(parseTelemetry("STATE=MANUAL;SENSOR_DATA=simulated;VALID=0")?.sensorData).toBe(
      "simulated",
    );
  });

  it("falls back to VALID when SENSOR_DATA is absent", () => {
    expect(parseTelemetry("STATE=MANUAL;VALID=1")?.sensorData).toBe("available");
    expect(parseTelemetry("STATE=MANUAL;VALID=0")?.sensorData).toBe("unavailable");
    expect(parseTelemetry("STATE=MANUAL")?.sensorData).toBe("unavailable");
  });

  it("ignores malformed sequence and age values", () => {
    const telemetry = parseTelemetry("STATE=MANUAL;SEQ=-1;AGE_MS=1.5");
    expect(telemetry?.lastSequence).toBeUndefined();
    expect(telemetry?.ageMs).toBeUndefined();
    expect(telemetry?.lastEvent).toBeUndefined();
  });

  it("ignores parts without a key/value separator", () => {
    const telemetry = parseTelemetry("STATE=MANUAL;heartbeat;EVENT=ACCEPTED");
    expect(telemetry?.safetyState).toBe("MANUAL");
    expect(telemetry?.lastEvent).toBe("ACCEPTED");
    expect(telemetry?.raw.HEARTBEAT).toBeUndefined();
  });

  it("keeps the last value when a key is repeated", () => {
    const telemetry = parseTelemetry("GPS=Tunis;GPS=Sousse");
    expect(telemetry?.raw.GPS).toBe("Sousse");
  });
});

describe("formatAge", () => {
  it("uses the reported age when present", () => {
    expect(formatAge(250, Date.now())).toBe("250 ms");
    expect(formatAge(1_500, Date.now())).toBe("1.5 s");
  });

  it("falls back to the receive timestamp", () => {
    const now = Date.now();
    expect(formatAge(undefined, now)).toMatch(/ms$/);
  });

  it("returns a placeholder for invalid ages", () => {
    expect(formatAge(undefined, Date.now() + 10_000)).toBe("—");
    expect(formatAge(Number.NaN, Date.now())).toBe("—");
  });
});
