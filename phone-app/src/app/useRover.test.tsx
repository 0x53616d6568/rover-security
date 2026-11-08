import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useRover } from "./useRover";

async function connectDemo() {
  const hook = renderHook(() => useRover());
  act(() => hook.result.current.toggleDemo());
  await act(async () => {
    await hook.result.current.connect();
  });
  return hook;
}

describe("useRover (demo transport)", () => {
  it("reports the MQTT transport and refuses to arm while disconnected", async () => {
    const { result } = renderHook(() => useRover());

    expect(result.current.state.supported).toBe(true);
    expect(result.current.state.supportMessage).toContain("MQTT");

    await act(async () => {
      await result.current.arm();
    });

    expect(result.current.state.safetyState).toBe("DISARMED");
    expect(result.current.state.events[0]?.message).toContain("connected, non-faulted rover");
  });

  it("connects, requires arming, drives, and stops", async () => {
    const { result, unmount } = await connectDemo();

    expect(result.current.state.connectionStatus).toBe("connected");
    expect(result.current.state.authorized).toBe(true);
    expect(result.current.state.links).toEqual({ telemetry: true, command: true });
    expect(result.current.state.safetyState).toBe("DISARMED");

    await act(async () => {
      await result.current.arm();
    });
    expect(result.current.state.safetyState).toBe("MANUAL");

    act(() => {
      result.current.setAxes(0.5, -0.25, true);
      result.current.setAxes(0.6, -0.3, true);
      result.current.setAxes(0, 0, false);
    });

    await waitFor(() => {
      expect(result.current.state.safetyState).toBe("MANUAL");
      expect(result.current.state.lastSequence).toBe(4);
    });
    expect(result.current.state.events.some((event) => event.message.includes("REJECT_SEQUENCE"))).toBe(
      false,
    );

    await act(async () => {
      await result.current.stop();
    });
    expect(result.current.state.safetyState).toBe("DISARMED");
    expect(result.current.state.lastCommand?.frame).toMatch(/^CMD,1,\d+,0,0\.000,0\.000,1$/);

    unmount();
  });

  it("does not auto-resume after reconnect", async () => {
    const { result, unmount } = await connectDemo();

    await act(async () => {
      await result.current.arm();
    });
    expect(result.current.state.safetyState).toBe("MANUAL");

    await act(async () => {
      await result.current.disconnect();
    });
    expect(result.current.state.safetyState).toBe("SAFE_STOP");
    expect(result.current.state.axes).toEqual({ forward: 0, turn: 0 });
    expect(result.current.state.links).toEqual({ telemetry: false, command: false });

    const sequenceBeforeReconnect = result.current.state.lastSequence;
    await act(async () => {
      await result.current.connect();
    });

    expect(result.current.state.connectionStatus).toBe("connected");
    expect(result.current.state.safetyState).toBe("DISARMED");
    expect(result.current.state.lastSequence).toBe(sequenceBeforeReconnect);

    // Axes changes must not command motion until the operator arms again.
    act(() => {
      result.current.setAxes(1, 1, true);
    });
    expect(result.current.state.lastSequence).toBe(sequenceBeforeReconnect);
    expect(result.current.state.safetyState).toBe("DISARMED");

    unmount();
  });

  it("keeps command sequences unique during rapid joystick updates", async () => {
    const { result, unmount } = await connectDemo();

    await act(async () => {
      await result.current.arm();
    });

    act(() => {
      for (let index = 0; index < 5; index += 1) {
        result.current.setAxes(0.1 * index, 0, true);
      }
      result.current.setAxes(0, 0, false);
    });

    await waitFor(() => {
      // Arm (1) + five drive frames (2-6) + neutral frame (7).
      expect(result.current.state.lastSequence).toBe(7);
    });
    expect(result.current.state.safetyState).toBe("MANUAL");
    expect(result.current.state.events.some((event) => event.message.includes("REJECT_SEQUENCE"))).toBe(
      false,
    );

    unmount();
  });
});
