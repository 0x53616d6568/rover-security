import { useCallback, useEffect, useRef, useReducer } from "react";

import { DemoAdapter, MqttAdapter } from "../ble";
import type { BleAdapter } from "../ble/types";
import { clampAxis, encodeCommand } from "../protocol/command";
import { parseTelemetry } from "../protocol/telemetry";
import type { CommandParams } from "../protocol/command";
import {
  appReducer,
  createEvent,
  initialState,
} from "./state";
import type { AppState } from "./state";

export function useRover() {
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    initialState(false, true, ""),
  );
  const stateRef = useRef<AppState>(state);
  const adapterRef = useRef<BleAdapter | null>(null);
  // Sequence numbers must be allocated synchronously: BLE writes are async and
  // the firmware rejects duplicate/regressing sequences with SAFE_STOP.
  const sequenceRef = useRef(0);

  const nextSequence = useCallback(() => {
    sequenceRef.current += 1;
    return sequenceRef.current;
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Recreate adapter when demo mode changes.
  useEffect(() => {
    const previous = adapterRef.current;
    if (previous) {
      void previous.disconnect().catch(() => undefined);
    }

    const adapter = state.demoMode ? new DemoAdapter() : new MqttAdapter();
    adapterRef.current = adapter;

    dispatch({
      type: "SET_SUPPORT",
      supported: adapter.isSupported(),
      message: adapter.supportMessage(),
    });

    const unsubStatus = adapter.onStatus((raw, receivedAt) => {
      const telemetry = parseTelemetry(raw, receivedAt);
      if (!telemetry) return;
      // The rover echoes its last accepted sequence. Adopt it so a reloaded or
      // reconnected app never sends a sequence the firmware has already seen.
      if (telemetry.lastSequence !== undefined) {
        sequenceRef.current = Math.max(sequenceRef.current, telemetry.lastSequence);
      }
      dispatch({ type: "STATUS_RECEIVED", telemetry });
    });
    const unsubConnection = adapter.onConnection((connected, authorized, receivedAt) => {
      dispatch({ type: "CONNECTION_CHANGED", connected, authorized, at: receivedAt });
    });
    const unsubLinks = adapter.onLinks((links) => {
      dispatch({ type: "LINKS_CHANGED", links });
    });

    return () => {
      unsubStatus();
      unsubConnection();
      unsubLinks();
      void adapter.disconnect().catch(() => undefined);
      if (adapterRef.current === adapter) adapterRef.current = null;
    };
  }, [state.demoMode]);

  // Conservative handling of page visibility.
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && stateRef.current.safetyState === "MANUAL") {
        void stopSoftware("PAGE_HIDDEN");
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, []);

  const connect = useCallback(async () => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    // Ignore repeat clicks while the browser chooser/GATT handshake is running.
    if (stateRef.current.connectionStatus === "connecting") return;
    dispatch({ type: "SET_CONNECTION_STATUS", status: "connecting" });
    try {
      await adapter.connect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Connection failed.";
      dispatch({ type: "CONNECTION_ERROR", message });
    }
  }, []);

  const disconnect = useCallback(async () => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    try {
      await adapter.disconnect();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Disconnect failed.";
      dispatch({ type: "CONNECTION_ERROR", message });
    }
  }, []);

  const sendCommand = useCallback(async (params: CommandParams) => {
    const adapter = adapterRef.current;
    if (!adapter) return;
    const frame = encodeCommand(params);
    try {
      await adapter.writeCommand(frame);
      dispatch({ type: "COMMAND_SENT", sequence: params.sequence, frame, at: Date.now() });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Command failed.";
      dispatch({ type: "CONNECTION_ERROR", message });
    }
  }, []);

  const arm = useCallback(async () => {
    const current = stateRef.current;
    if (!current.supported || current.connectionStatus !== "connected" || current.safetyState === "FAULT") {
      dispatch({ type: "PUSH_EVENT", event: createEvent("warn", "Arming requires a connected, non-faulted rover.") });
      return;
    }
    dispatch({ type: "SET_ARM_PENDING", pending: true });
    const sequence = nextSequence();
    await sendCommand({ sequence, arm: true, forward: 0, turn: 0, stop: false });
    dispatch({ type: "SET_ARM_PENDING", pending: false });
  }, [nextSequence, sendCommand]);

  const disarm = useCallback(async () => {
    const sequence = nextSequence();
    await sendCommand({ sequence, arm: false, forward: 0, turn: 0, stop: false });
  }, [nextSequence, sendCommand]);

  async function stopSoftware(reason = "SOFTWARE_STOP") {
    const sequence = nextSequence();
    await sendCommand({ sequence, arm: false, forward: 0, turn: 0, stop: true });
    dispatch({ type: "PUSH_EVENT", event: createEvent("warn", `${reason}: software stop sent.`) });
  }

  const stop = useCallback(async () => {
    await stopSoftware("SOFTWARE_STOP");
  }, [nextSequence, sendCommand]);

  const setAxes = useCallback(
    (forward: number, turn: number, active: boolean) => {
      const clamped = { forward: clampAxis(forward), turn: clampAxis(turn) };
      dispatch({ type: "AXES_CHANGED", axes: clamped, active });
      const current = stateRef.current;
      if (!active) {
        if (current.safetyState === "MANUAL") {
          const sequence = nextSequence();
          void sendCommand({ sequence, arm: true, forward: 0, turn: 0, stop: false });
        }
        return;
      }
      if (current.safetyState === "MANUAL") {
        const sequence = nextSequence();
        void sendCommand({ sequence, arm: true, forward: clamped.forward, turn: clamped.turn, stop: false });
      }
    },
    [nextSequence, sendCommand],
  );

  // Controlled command cadence while driving.
  useEffect(() => {
    if (!state.joystickActive || state.safetyState !== "MANUAL") return;
    const id = window.setInterval(() => {
      const current = stateRef.current;
      if (!current.joystickActive || current.safetyState !== "MANUAL") return;
      const sequence = nextSequence();
      const frameParams: CommandParams = {
        sequence,
        arm: true,
        forward: current.axes.forward,
        turn: current.axes.turn,
        stop: false,
      };
      const adapter = adapterRef.current;
      if (!adapter) return;
      const frame = encodeCommand(frameParams);
      void adapter
        .writeCommand(frame)
        .then(() => dispatch({ type: "COMMAND_SENT", sequence, frame, at: Date.now() }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : "Command failed.";
          dispatch({ type: "CONNECTION_ERROR", message });
        });
    }, 150);
    return () => window.clearInterval(id);
  }, [nextSequence, state.joystickActive, state.safetyState]);

  const toggleDemo = useCallback(() => {
    dispatch({ type: "SET_DEMO_MODE", enabled: !stateRef.current.demoMode });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: "CLEAR_CONNECTION_ERROR" });
  }, []);

  return {
    state,
    dispatch,
    connect,
    disconnect,
    arm,
    disarm,
    stop,
    setAxes,
    toggleDemo,
    clearError,
  };
}