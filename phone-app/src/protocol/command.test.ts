import { describe, expect, it } from "vitest";

import { clampAxis, encodeCommand, isSafetyState } from "./command";

describe("clampAxis", () => {
  it("clamps values into the firmware-accepted range", () => {
    expect(clampAxis(0.4)).toBe(0.4);
    expect(clampAxis(2)).toBe(1);
    expect(clampAxis(-2)).toBe(-1);
  });

  it("maps non-finite values to neutral", () => {
    expect(clampAxis(Number.NaN)).toBe(0);
    expect(clampAxis(Number.POSITIVE_INFINITY)).toBe(0);
    expect(clampAxis(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe("encodeCommand", () => {
  it("emits the exact firmware frame layout", () => {
    expect(
      encodeCommand({
        sequence: 7,
        arm: true,
        forward: 0.5,
        turn: -0.25,
        stop: false,
      }),
    ).toBe("CMD,1,7,1,0.500,-0.250,0");
  });

  it("defaults to protocol version 1 and supports version overrides", () => {
    expect(
      encodeCommand({ sequence: 1, arm: false, forward: 0, turn: 0, stop: true }),
    ).toBe("CMD,1,1,0,0.000,0.000,1");
    expect(
      encodeCommand({
        version: 2,
        sequence: 1,
        arm: false,
        forward: 0,
        turn: 0,
        stop: true,
      }),
    ).toBe("CMD,2,1,0,0.000,0.000,1");
  });

  it("clamps axes before writing so malformed values never reach the rover", () => {
    expect(
      encodeCommand({
        sequence: 3,
        arm: true,
        forward: 9,
        turn: -9,
        stop: false,
      }),
    ).toBe("CMD,1,3,1,1.000,-1.000,0");
  });

  it("truncates fractional sequence numbers", () => {
    expect(
      encodeCommand({ sequence: 12.9, arm: false, forward: 0, turn: 0, stop: true }),
    ).toBe("CMD,1,12,0,0.000,0.000,1");
  });
});

describe("isSafetyState", () => {
  it("accepts only firmware safety states", () => {
    for (const state of ["BOOT_SAFE", "DISARMED", "MANUAL", "SAFE_STOP", "FAULT"]) {
      expect(isSafetyState(state)).toBe(true);
    }
    expect(isSafetyState("manual")).toBe(false);
    expect(isSafetyState("UNKNOWN")).toBe(false);
    expect(isSafetyState("")).toBe(false);
  });
});
