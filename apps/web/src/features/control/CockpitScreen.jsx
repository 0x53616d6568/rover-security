/**
 * CockpitScreen
 *
 * Full-viewport Rover_Cockpit 3D interface. Bridges React rover state to the
 * cockpit iframe and routes cockpit actions back into the command layer:
 *   React → iframe : CONNECTED, LINKS, STATE, TELEMETRY
 *   iframe → React : ARM, DISARM, ESTOP, AXES, NAVIGATE, TOGGLE_CLASSIC
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Gamepad2 } from "lucide-react";

import ControlScreen from "./ControlScreen";
import { Button, StatusPill } from "../../shared/ui";

export default function CockpitScreen({
  state,
  connected,
  arm,
  disarm,
  stop,
  setAxes,
  onNavigate,
  selectedRoverId,
}) {
  const [viewMode, setViewMode] = useState("3d"); // "3d" | "classic"
  const [hudVersion, setHudVersion] = useState(() => Date.now());
  const iframeRef = useRef(null);
  const canCommand = connected && Boolean(selectedRoverId);

  /** Send a message to the iframe safely. */
  const send = useCallback((message) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(message, "*");
    } catch {
      // The iframe may have been replaced during a HUD reload.
    }
  }, []);

  useEffect(() => {
    send({ type: "CONNECTED", connected, command: state.links.command });
  }, [connected, state.links.command, send]);

  useEffect(() => {
    send({
      type: "LINKS",
      telemetry: state.links.telemetry,
      command: state.links.command,
      connectionStatus: state.connectionStatus,
    });
  }, [state.links.telemetry, state.links.command, state.connectionStatus, send]);

  useEffect(() => {
    send({ type: "STATE", armed: state.safetyState === "MANUAL" });
  }, [state.safetyState, send]);

  useEffect(() => {
    if (!state.telemetry?.raw) return;
    send({
      type: "TELEMETRY",
      data: state.telemetry.raw,
      rawString: state.telemetry.rawString || "",
    });
  }, [state.telemetry, send]);

  const onLoad = useCallback(() => {
    send({ type: "CONNECTED", connected, command: state.links.command });
    send({
      type: "LINKS",
      telemetry: state.links.telemetry,
      command: state.links.command,
      connectionStatus: state.connectionStatus,
    });
    send({ type: "STATE", armed: state.safetyState === "MANUAL" });
    if (state.telemetry?.raw) {
      send({
        type: "TELEMETRY",
        data: state.telemetry.raw,
        rawString: state.telemetry.rawString || "",
      });
    }
  }, [
    connected,
    state.links.telemetry,
    state.links.command,
    state.connectionStatus,
    state.safetyState,
    state.telemetry,
    send,
  ]);

  useEffect(() => {
    const hot = import.meta.hot;
    if (!hot) return undefined;
    const reloadHud = () => setHudVersion(Date.now());
    hot.on("cockpit-hud-update", reloadHud);
    return () => hot.off("cockpit-hud-update", reloadHud);
  }, []);

  useEffect(() => {
    const handler = (event) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      switch (data.type) {
        case "ARM":
          if (canCommand) arm();
          break;
        case "DISARM":
          if (canCommand) disarm();
          break;
        case "ESTOP":
          if (canCommand) stop();
          break;
        case "AXES":
          if (canCommand && state.safetyState === "MANUAL") {
            setAxes(
              Math.max(-1, Math.min(1, data.forward ?? 0)),
              Math.max(-1, Math.min(1, data.turn ?? 0)),
              data.active ?? false,
            );
          }
          break;
        case "NAVIGATE":
          if (onNavigate) onNavigate(data.to || "connection");
          break;
        case "TOGGLE_CLASSIC":
          setViewMode((mode) => (mode === "3d" ? "classic" : "3d"));
          break;
        default:
          break;
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [canCommand, state.safetyState, arm, disarm, stop, setAxes, onNavigate]);

  if (viewMode === "classic") {
    return (
      <div className="min-h-screen bg-bg px-3 py-4 sm:px-5">
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => onNavigate?.("connection")}>
                <ArrowLeft size={13} />
                Menu
              </Button>
              <div>
                <div className="micro-label">Classic control</div>
                <div className="text-sm font-medium text-ink">RoverX · TerraRover X1</div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill
                tone={state.safetyState === "MANUAL" ? "live" : state.safetyState === "FAULT" ? "danger" : "neutral"}
                label={state.safetyState}
                dot={false}
              />
              <StatusPill tone={state.links.command ? "live" : "danger"} label={state.links.command ? "CMD online" : "CMD offline"} />
              <Button variant="secondary" size="sm" onClick={() => setViewMode("3d")}>
                <Gamepad2 size={13} />
                3D cockpit
              </Button>
            </div>
          </div>

          <ControlScreen
            state={state}
            connected={connected}
            arm={arm}
            disarm={disarm}
            stop={stop}
            setAxes={setAxes}
            onNavigate={onNavigate}
            selectedRoverId={selectedRoverId}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#070b10]">
      <div className="pointer-events-auto absolute left-2 top-2 z-30 sm:hidden">
        <button
          type="button"
          onClick={() => onNavigate?.("connection")}
          className="rounded-full border border-line-strong bg-black/70 p-2 text-ink-muted backdrop-blur-md hover:text-ink"
          title="Return to menu"
          aria-label="Return to menu"
        >
          <ArrowLeft size={16} />
        </button>
      </div>

      <iframe
        key={hudVersion}
        ref={iframeRef}
        src={import.meta.env.DEV ? `/cockpit.html?v=${hudVersion}` : "/cockpit.html"}
        onLoad={onLoad}
        title="Rover cockpit"
        className="block h-full w-full border-0"
        allow="pointer-lock; fullscreen"
      />
    </div>
  );
}
