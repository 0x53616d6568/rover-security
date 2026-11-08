import { describe, expect, it } from "vitest";

import { parseTelemetry } from "../protocol/telemetry";
import { appReducer, createEvent, initialState } from "./state";

const telemetry = (raw: string) => {
  const parsed = parseTelemetry(raw, 1_000);
  if (!parsed) throw new Error("test fixture did not parse");
  return parsed;
};

describe("initialState", () => {
  it("starts disarmed and idle", () => {
    const state = initialState();
    expect(state.connectionStatus).toBe("idle");
    expect(state.safetyState).toBe("DISARMED");
    expect(state.authorized).toBe(false);
    expect(state.links).toEqual({ telemetry: false, command: false });
    expect(state.axes).toEqual({ forward: 0, turn: 0 });
    expect(state.lastSequence).toBe(0);
  });
});

describe("CONNECTION_CHANGED", () => {
  it("requires an explicit re-arm after connecting", () => {
    const state = appReducer(
      { ...initialState(), safetyState: "MANUAL", axes: { forward: 0.5, turn: 0.2 }, joystickActive: true },
      { type: "CONNECTION_CHANGED", connected: true, authorized: true, at: 1_000 },
    );

    expect(state.connectionStatus).toBe("connected");
    expect(state.authorized).toBe(true);
    expect(state.safetyState).toBe("DISARMED");
    expect(state.axes).toEqual({ forward: 0, turn: 0 });
    expect(state.joystickActive).toBe(false);
    expect(state.events[0]?.message).toContain("Re-arm required");
  });

  it("marks the link as disconnected but does not claim authorization", () => {
    const state = appReducer(
      { ...initialState(), safetyState: "MANUAL" },
      { type: "CONNECTION_CHANGED", connected: true, authorized: false, at: 1_000 },
    );

    expect(state.connectionStatus).toBe("connected");
    expect(state.authorized).toBe(false);
  });

  it("falls back to SAFE_STOP and neutral axes when the link is lost", () => {
    const state = appReducer(
      {
        ...initialState(),
        connectionStatus: "connected",
        authorized: true,
        safetyState: "MANUAL",
        axes: { forward: 1, turn: 1 },
        joystickActive: true,
      },
      { type: "CONNECTION_CHANGED", connected: false, authorized: false, at: 1_000 },
    );

    expect(state.connectionStatus).toBe("disconnected");
    expect(state.authorized).toBe(false);
    expect(state.safetyState).toBe("SAFE_STOP");
    expect(state.axes).toEqual({ forward: 0, turn: 0 });
    expect(state.events[0]?.message).toContain("Motion stopped");
  });
});

describe("LINKS_CHANGED", () => {
  it("tracks telemetry and command links independently", () => {
    const state = appReducer(initialState(), {
      type: "LINKS_CHANGED",
      links: { telemetry: true, command: false },
    });

    expect(state.links).toEqual({ telemetry: true, command: false });
  });

  it("clears both links on a connection error", () => {
    const state = appReducer(
      { ...initialState(), links: { telemetry: true, command: true } },
      { type: "CONNECTION_ERROR", message: "Command broker timed out" },
    );

    expect(state.links).toEqual({ telemetry: false, command: false });
  });
});

describe("STATUS_RECEIVED", () => {
  it("treats firmware telemetry as authoritative", () => {
    const state = appReducer(
      initialState(),
      { type: "STATUS_RECEIVED", telemetry: telemetry("STATE=MANUAL;EVENT=ACCEPTED;SEQ=9") },
    );

    expect(state.safetyState).toBe("MANUAL");
    expect(state.lastAck).toEqual({ sequence: 9, event: "ACCEPTED", receivedAt: 1_000 });
    expect(state.lastSequence).toBe(9);
    expect(state.events[0]?.message).toContain("ACCEPTED");
  });

  it("adopts the rover sequence without ever moving backwards", () => {
    const base = { ...initialState(), lastSequence: 12 };
    const lower = appReducer(base, {
      type: "STATUS_RECEIVED",
      telemetry: telemetry("STATE=DISARMED;SEQ=3"),
    });
    const higher = appReducer(base, {
      type: "STATUS_RECEIVED",
      telemetry: telemetry("STATE=DISARMED;SEQ=20"),
    });

    expect(lower.lastSequence).toBe(12);
    expect(higher.lastSequence).toBe(20);
  });

  it("does not create events for heartbeats or frames without an event", () => {
    const heartbeat = appReducer(initialState(), {
      type: "STATUS_RECEIVED",
      telemetry: telemetry("STATE=MANUAL;EVENT=HEARTBEAT;SEQ=5"),
    });
    const periodic = appReducer(initialState(), {
      type: "STATUS_RECEIVED",
      telemetry: telemetry("STATE=MANUAL;VALID=0;SENSOR_DATA=UNAVAILABLE;AGE_MS=0"),
    });

    expect(heartbeat.events).toHaveLength(0);
    expect(periodic.events).toHaveLength(0);
  });

  it("classifies rejections and faults as errors", () => {
    const rejected = appReducer(initialState(), {
      type: "STATUS_RECEIVED",
      telemetry: telemetry("STATE=SAFE_STOP;EVENT=REJECT_SEQUENCE;SEQ=5"),
    });
    const faulted = appReducer(initialState(), {
      type: "STATUS_RECEIVED",
      telemetry: telemetry("STATE=FAULT;EVENT=FAULT;SEQ=5"),
    });

    expect(rejected.events[0]?.severity).toBe("error");
    expect(faulted.events[0]?.severity).toBe("error");
  });
});

describe("command and session bookkeeping", () => {
  it("records the last sent command", () => {
    const state = appReducer(initialState(), {
      type: "COMMAND_SENT",
      sequence: 4,
      frame: "CMD,1,4,0,0.000,0.000,1",
      at: 1_000,
    });

    expect(state.lastSequence).toBe(4);
    expect(state.lastCommand).toEqual({
      sequence: 4,
      frame: "CMD,1,4,0,0.000,0.000,1",
      sentAt: 1_000,
    });
  });

  it("keeps a bounded event history", () => {
    let state = initialState();
    for (let index = 0; index < 40; index += 1) {
      state = appReducer(state, {
        type: "PUSH_EVENT",
        event: createEvent("info", `event ${index}`, index),
      });
    }

    expect(state.events).toHaveLength(24);
    expect(state.events[0]?.message).toBe("event 39");
    expect(state.events.at(-1)?.message).toBe("event 16");
  });

  it("resets session state but keeps the demo preference", () => {
    const state = appReducer(
      {
        ...initialState(true, true, "demo"),
        connectionStatus: "connected",
        safetyState: "MANUAL",
        lastSequence: 8,
      },
      { type: "RESET_SESSION" },
    );

    expect(state.connectionStatus).toBe("idle");
    expect(state.safetyState).toBe("DISARMED");
    expect(state.demoMode).toBe(true);
    expect(state.lastSequence).toBe(0);
  });

  it("records connection errors", () => {
    const state = appReducer(initialState(), {
      type: "CONNECTION_ERROR",
      message: "Bluetooth unavailable",
    });

    expect(state.connectionStatus).toBe("error");
    expect(state.connectionError).toBe("Bluetooth unavailable");
    expect(state.events[0]?.severity).toBe("error");
  });
});
