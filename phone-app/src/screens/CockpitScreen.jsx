/**
 * CockpitScreen.jsx
 *
 * Implements the Rover_Cockpit 3D interface replacing the old control screen.
 * Takes the full viewport cleanly and bridges React BLE state <-> Cockpit iframe:
 *   React → iframe : CONNECTED, STATE, TELEMETRY
 *   iframe → React : ARM, DISARM, ESTOP, AXES, NAVIGATE, TOGGLE_CLASSIC
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import ControlScreen from "./ControlScreen";

export default function CockpitScreen({
  state,
  connected,
  arm,
  disarm,
  stop,
  setAxes,
  onNavigate,
}) {
  const [viewMode, setViewMode] = useState("3d"); // "3d" | "classic"
  const iframeRef = useRef(null);

  /** Send a message to the iframe safely */
  const send = useCallback((msg) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(msg, "*");
    } catch (_) {}
  }, []);

  /* ── Push connection status whenever it changes ── */
  useEffect(() => {
    send({ type: "CONNECTED", connected });
  }, [connected, send]);

  /* ── Push arm / safety state whenever it changes ── */
  useEffect(() => {
    send({
      type: "STATE",
      armed: state.safetyState === "MANUAL",
    });
  }, [state.safetyState, send]);

  /* ── Push real telemetry to cockpit HUD whenever it updates ── */
  useEffect(() => {
    if (!state.telemetry?.raw) return;
    send({
      type: "TELEMETRY",
      data: state.telemetry.raw,
      rawString: state.telemetry.rawString || "",
    });
  }, [state.telemetry, send]);

  /* ── Re-send state once the iframe finishes loading ── */
  const onLoad = useCallback(() => {
    send({ type: "CONNECTED", connected });
    send({ type: "STATE", armed: state.safetyState === "MANUAL" });
    if (state.telemetry?.raw) {
      send({
        type: "TELEMETRY",
        data: state.telemetry.raw,
        rawString: state.telemetry.rawString || "",
      });
    }
  }, [connected, state.safetyState, state.telemetry, send]);

  /* ── Listen for commands coming back from the cockpit ── */
  useEffect(() => {
    const handler = (e) => {
      const d = e.data;
      if (!d || typeof d !== "object") return;
      switch (d.type) {
        case "ARM":
          if (connected) arm();
          break;
        case "DISARM":
          disarm();
          break;
        case "ESTOP":
          stop();
          break;
        case "AXES":
          if (connected && state.safetyState === "MANUAL") {
            setAxes(
              Math.max(-1, Math.min(1, d.forward ?? 0)),
              Math.max(-1, Math.min(1, d.turn ?? 0)),
              d.active ?? false
            );
          }
          break;
        case "NAVIGATE":
          if (onNavigate) onNavigate(d.to || "connection");
          break;
        case "TOGGLE_CLASSIC":
          setViewMode((v) => (v === "3d" ? "classic" : "3d"));
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [connected, state.safetyState, arm, disarm, stop, setAxes, onNavigate]);

  if (viewMode === "classic") {
    return (
      <div className="min-h-screen bg-black text-white p-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
            <button
              onClick={() => onNavigate?.("connection")}
              className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white"
            >
              <ArrowLeft size={14} />
              <span>Menu</span>
            </button>
            <button
              onClick={() => setViewMode("3d")}
              className="flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-950/40 px-3 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-900/60"
            >
              <Gamepad2 size={14} />
              Switch to 3D Cockpit
            </button>
          </div>
          <ControlScreen
            state={state}
            connected={connected}
            arm={arm}
            disarm={disarm}
            stop={stop}
            setAxes={setAxes}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070B10]">
      {/* Subtle back button for landscape phone HUD where topbar is hidden */}
      <div className="pointer-events-auto absolute top-2 left-2 z-30 sm:hidden">
        <button
          onClick={() => onNavigate?.("connection")}
          className="rounded-full border border-white/20 bg-black/70 p-2 text-white/70 backdrop-blur-md hover:text-white"
          title="Return to Menu"
        >
          <ArrowLeft size={16} />
        </button>
      </div>

      <iframe
        ref={iframeRef}
        src="/cockpit.html"
        onLoad={onLoad}
        title="Rover Cockpit"
        className="h-full w-full border-0 block"
        allow="pointer-lock; fullscreen"
      />
    </div>
  );
}
