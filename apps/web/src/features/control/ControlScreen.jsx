import { Activity, Camera, Gamepad2, LayoutDashboard, Settings } from "lucide-react";
import { useEffect, useRef } from "react";

import MapView from "../telemetry/components/MapView";
import GpsCard from "../telemetry/components/GpsCard";
import EnvironmentCard from "../telemetry/components/EnvironmentCard";
import PowerCard from "../telemetry/components/PowerCard";
import CameraCard from "../telemetry/components/CameraCard";
import Joystick from "./components/Joystick";
import Compass from "./components/Compass";
import { readNumber, readText } from "../../shared/lib/readings";
import { Button, Metric, Panel, StatusPill } from "../../shared/ui";

const navItems = [
  { id: "welcome", label: "Dashboard", icon: LayoutDashboard },
  { id: "control", label: "Control", icon: Gamepad2 },
  { id: "telemetry", label: "Telemetry", icon: Activity },
  { id: "camera", label: "Camera", icon: Camera },
  { id: "connection", label: "Settings", icon: Settings },
];

export default function ControlScreen({
  state,
  connected,
  arm,
  disarm,
  stop,
  setAxes,
  onNavigate,
  selectedRoverId,
}) {
  const raw = state.telemetry?.raw ?? {};
  const ready = connected && Boolean(selectedRoverId);
  const armed = state.safetyState === "MANUAL";
  const heading = readNumber(raw, "HEADING");
  const battery = readNumber(raw, "BATTERY");
  const gps = readText(raw, "GPS", "");
  const hasGps = gps !== "";
  const cameraState = readText(raw, "CAMERA", "not configured").toLowerCase();
  const cameraReady = ["ready", "streaming", "live", "available"].includes(cameraState);
  const pressed = useRef(new Set());

  useEffect(() => {
    const isTyping = (target) => {
      const tag = target?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || target?.isContentEditable;
    };

    const updateAxes = () => {
      if (!ready || state.safetyState !== "MANUAL") return;
      const forward =
        (pressed.current.has("KeyZ") || pressed.current.has("ArrowUp") ? 1 : 0) +
        (pressed.current.has("KeyS") || pressed.current.has("ArrowDown") ? -1 : 0);
      const turn =
        (pressed.current.has("KeyD") || pressed.current.has("ArrowRight") ? 1 : 0) +
        (pressed.current.has("KeyQ") || pressed.current.has("ArrowLeft") ? -1 : 0);
      const active = forward !== 0 || turn !== 0;
      setAxes(Math.max(-1, Math.min(1, forward)), Math.max(-1, Math.min(1, turn)), active);
    };

    const onKeyDown = (event) => {
      if (isTyping(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        stop();
        return;
      }
      if (["KeyZ", "KeyS", "KeyQ", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        pressed.current.add(event.code);
        updateAxes();
      }
    };

    const onKeyUp = (event) => {
      if (["KeyZ", "KeyS", "KeyQ", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        pressed.current.delete(event.code);
        updateAxes();
      }
    };

    const onBlur = () => {
      pressed.current.clear();
      setAxes(0, 0, false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      pressed.current.clear();
    };
  }, [ready, state.safetyState, setAxes, stop]);

  return (
    <div className="grid gap-3 lg:grid-cols-[56px_1fr_300px]">
      <aside className="hidden flex-col items-center gap-2 rounded-lg border border-line bg-surface p-2 lg:flex">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-accent/40 bg-accent-soft font-mono text-[10px] font-semibold text-accent">
          RX
        </div>
        {navItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => onNavigate?.(id)}
            className={`flex h-9 w-9 items-center justify-center rounded-sm transition-colors ${
              id === "control" ? "bg-accent-soft text-accent" : "text-ink-faint hover:bg-surface-2 hover:text-ink"
            }`}
          >
            <Icon size={16} />
          </button>
        ))}
        <div className="mt-auto flex h-9 w-9 items-center justify-center">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-live" : "bg-danger"}`} />
        </div>
      </aside>

      <div className="min-w-0 space-y-3">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-accent" />
              <span className="text-xs font-medium text-ink">ESP32-CAM feed</span>
            </div>
            <StatusPill tone={cameraReady ? "live" : "neutral"} label={cameraReady ? "Ready" : "No feed"} />
          </div>
          <div className="relative aspect-video w-full overflow-hidden bg-[#050807]">
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-ink-faint">
              Camera feed is not configured for Phase 1 BLE control.
            </div>
            <div className="pointer-events-none absolute left-3 top-3 space-y-1 font-mono text-[10px] text-ink-muted">
              <div className="rounded-sm bg-black/65 px-2 py-1">Speed {readText(raw, "SPEED", "—")} m/s</div>
              <div className="rounded-sm bg-black/65 px-2 py-1">Heading {readText(raw, "HEADING", "—")}°</div>
              <div className="rounded-sm bg-black/65 px-2 py-1">Pitch {readText(raw, "PITCH", "—")}°</div>
              <div className="rounded-sm bg-black/65 px-2 py-1">Roll {readText(raw, "ROLL", "—")}°</div>
            </div>
            <div className="absolute bottom-3 right-3 rounded-sm bg-black/65 px-2 py-1 font-mono text-[10px] text-ink-faint">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </Panel>

        <div className="grid min-w-0 grid-cols-2 gap-2">
          <Panel className="min-w-0 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="micro-label">GPS / map</span>
              <StatusPill tone={hasGps ? "live" : "neutral"} label={hasGps ? "Fix" : "No fix"} dot={false} />
            </div>
            <div className="h-36 min-w-0 overflow-hidden rounded-sm border border-line">
              <MapView center={[36.8065, 10.1815]} label={hasGps ? gps : "Rover position unavailable"} showMarker={hasGps} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Metric label="Fix" value={readText(raw, "GPS_FIX", "—")} />
              <Metric label="Sats" value={readText(raw, "SATS", "—")} />
              <Metric label="Accuracy" value={readText(raw, "GPS_ACC", "—")} />
              <Metric label="Heading" value={readText(raw, "HEADING", "—")} unit="°" />
            </div>
          </Panel>

          <Panel className="p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="micro-label">Manual driving</span>
              <StatusPill tone={state.links.command ? "live" : "danger"} label={state.links.command ? "CMD online" : "CMD offline"} />
            </div>
            <div className="flex h-36 items-center justify-center">
              <div className="scale-75 sm:scale-90">
                <Joystick
                  disabled={!ready || !armed}
                  axes={state.axes}
                  onAxesChange={(forward, turn, active) => setAxes(forward, turn, active)}
                />
              </div>
            </div>
            <div className="mt-2 text-center font-mono text-[10px] text-ink-faint">
              Throttle {state.axes.forward.toFixed(2)} · Steering {state.axes.turn.toFixed(2)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant={armed ? "secondary" : "live"} size="sm" disabled={!ready} onClick={() => (armed ? disarm() : arm())}>
                {armed ? "Disarm" : "Arm"}
              </Button>
              <Button variant="danger" size="sm" disabled={!ready} onClick={() => stop()}>
                Emergency stop
              </Button>
            </div>
          </Panel>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="micro-label">Battery</span>
              <span className="data-value text-xs text-ink-muted">{battery === null ? "—" : `${Math.round(battery)}%`}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-pill bg-surface-3">
              <div
                className={`h-full rounded-pill ${battery !== null && battery < 20 ? "bg-danger" : "bg-live"}`}
                style={{ width: battery === null ? "0%" : `${Math.min(100, Math.max(0, battery))}%` }}
              />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Metric label="Voltage" value={readText(raw, "BATTERY_V", "—")} unit="V" />
              <Metric label="Current" value={readText(raw, "BATTERY_A", "—")} unit="A" />
              <Metric label="Capacity" value={readText(raw, "BATTERY_CAP", "—")} />
              <Metric label="Status" value={battery === null ? "Unavailable" : battery < 20 ? "Low" : "Healthy"} />
            </div>
          </Panel>

          <Panel className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="micro-label">Attitude</span>
              <span className="font-mono text-[10px] text-ink-faint">{raw.IMU_VALIDITY ?? "unavailable"}</span>
            </div>
            <div className="flex items-center gap-4">
              <Compass heading={heading} />
              <div className="grid flex-1 grid-cols-2 gap-2">
                <Metric label="Heading" value={readText(raw, "HEADING", "—")} unit="°" />
                <Metric label="Pitch" value={readText(raw, "PITCH", "—")} unit="°" />
                <Metric label="Roll" value={readText(raw, "ROLL", "—")} unit="°" />
                <Metric label="Motor" value={readText(raw, "MOTOR", "—")} />
              </div>
            </div>
          </Panel>
        </div>

        <div className="hidden rounded-md border border-line bg-surface px-3 py-2 text-[10px] text-ink-faint md:block">
          <span className="font-mono uppercase tracking-[0.1em]">Keyboard</span> Z/↑ forward · S/↓ reverse · Q/← left ·
          D/→ right · Space stop · release neutral
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <GpsCard telemetry={state.telemetry} />
          <EnvironmentCard telemetry={state.telemetry} />
          <PowerCard telemetry={state.telemetry} />
          <CameraCard telemetry={state.telemetry} />
        </div>
      </div>

      <aside className="space-y-3">
        <Panel className="p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-accent/40 bg-accent-soft font-mono text-[10px] font-semibold text-accent">
              RX
            </div>
            <div>
              <div className="text-sm font-semibold text-ink">RoverX</div>
              <div className="text-[10px] text-ink-faint">TerraRover X1</div>
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 text-[11px]">
            {[
              ["Selected rover", selectedRoverId ?? "None"],
              ["ESP32", ready ? "Connected" : "Disconnected"],
              ["Firmware", readText(raw, "FW", "unknown")],
              ["BLE RSSI", readText(raw, "RSSI", "N/A")],
              ["Last ACK", state.lastAck ? `${state.lastAck.event} #${state.lastAck.sequence}` : "—"],
              ["Telemetry age", readText(raw, "AGE_MS", "—") === "—" ? "—" : `${readText(raw, "AGE_MS", "—")} ms`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-2">
                <dt className="text-ink-faint">{label}</dt>
                <dd className="data-value truncate text-ink-muted">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="micro-label">Connection</span>
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-live" : "bg-danger"}`} />
          </div>
          <div className="text-xs text-ink">{connected ? "Link active" : "No communication"}</div>
          <div className="mt-1 text-[10px] text-ink-faint">
            {connected ? "Command and status channels are up." : "Motion authority is unavailable."}
          </div>
        </Panel>

        <Panel className="p-3">
          <div className="mb-2 micro-label">Environment</div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Temp" value={readText(raw, "TEMP", "—")} unit="°C" />
            <Metric label="Humidity" value={readText(raw, "HUMIDITY", "—")} unit="%" />
            <Metric label="Wind" value={readText(raw, "WIND", "—")} />
            <Metric label="Pressure" value={readText(raw, "PRESSURE", "—")} />
          </div>
        </Panel>

        <Panel className="p-3">
          <div className="mb-2 micro-label">Compass</div>
          <Compass heading={heading} />
        </Panel>
      </aside>
    </div>
  );
}
