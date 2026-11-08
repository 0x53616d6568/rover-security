import { LayoutDashboard, Gamepad2, Activity, Camera, Settings } from "lucide-react";
import { useEffect, useRef } from "react";
import MapView from "../components/MapView";
import Joystick from "../components/Joystick";
import GpsCard from "../components/GpsCard";
import EnvironmentCard from "../components/EnvironmentCard";
import PowerCard from "../components/PowerCard";
import CameraCard from "../components/CameraCard";
import Compass from "../components/Compass";
import { readNumber, readText } from "../components/readings";

const panel = "rounded-2xl border border-white/10 bg-white/[0.04] p-3";

export default function ControlScreen({ state, connected, arm, disarm, stop, setAxes, onNavigate }) {
  const raw = state.telemetry?.raw ?? {};
  const heading = readNumber(raw, "HEADING");
  const battery = readNumber(raw, "BATTERY");
  const gps = readText(raw, "GPS", "");
  const hasGps = gps !== "";
  const cameraState = readText(raw, "CAMERA", "not configured").toLowerCase();
  const cameraReady = ["ready", "streaming", "live", "available"].includes(cameraState);
  const temp = readText(raw, "TEMP", "—");
  const humidity = readText(raw, "HUMIDITY", "—");
  const wind = readText(raw, "WIND", "—");
  const pressure = readText(raw, "PRESSURE", "N/A");
  const telemetryAge = readText(raw, "AGE_MS", "—");
  const pressed = useRef(new Set());

  useEffect(() => {
    const isTyping = (target) => {
      const tag = target?.tagName?.toLowerCase();
      return tag === "input" || tag === "textarea" || target?.isContentEditable;
    };

    const updateAxes = () => {
      if (!connected || state.safetyState !== "MANUAL") return;
      const forward = (pressed.current.has("KeyZ") || pressed.current.has("ArrowUp") ? 1 : 0) +
        (pressed.current.has("KeyS") || pressed.current.has("ArrowDown") ? -1 : 0);
      const turn = (pressed.current.has("KeyD") || pressed.current.has("ArrowRight") ? 1 : 0) +
        (pressed.current.has("KeyQ") || pressed.current.has("ArrowLeft") ? -1 : 0);
      const active = forward !== 0 || turn !== 0;
      setAxes(Math.max(-1, Math.min(1, forward)), Math.max(-1, Math.min(1, turn)), active);
    };

    const onKeyDown = (e) => {
      if (isTyping(e.target)) return;
      if (e.code === "Space") {
        e.preventDefault();
        stop();
        return;
      }
      if (["KeyZ", "KeyS", "KeyQ", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
        pressed.current.add(e.code);
        updateAxes();
      }
    };

    const onKeyUp = (e) => {
      if (["KeyZ", "KeyS", "KeyQ", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        pressed.current.delete(e.code);
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
  }, [connected, state.safetyState, setAxes, stop]);

  return (
    <div className="grid gap-3 lg:grid-cols-[64px_1fr_300px]">
      {/* Left rail */}
      <aside className="hidden lg:flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-black/40 p-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">RX</div>
        <button title="Dashboard" onClick={() => onNavigate?.("welcome")} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"><LayoutDashboard size={16} /></button>
        <button title="Control" onClick={() => onNavigate?.("control")} className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white"><Gamepad2 size={16} /></button>
        <button title="Telemetry" onClick={() => onNavigate?.("telemetry")} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"><Activity size={16} /></button>
        <button title="Camera" onClick={() => onNavigate?.("camera")} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"><Camera size={16} /></button>
        <button title="Settings" onClick={() => onNavigate?.("connection")} className="flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"><Settings size={16} /></button>
        <div className="mt-auto flex h-9 w-9 items-center justify-center rounded-lg">
          <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
        </div>
      </aside>

      {/* Central workspace */}
      <div className="space-y-3">
        {/* Camera feed */}
        <div className={`${panel} relative overflow-hidden`}>
          <div className="flex items-center justify-between text-xs text-white/70">
            <span>ESP32-CAM feed</span>
            <span className={cameraReady ? "text-green-400" : "text-white/50"}>
              {cameraReady ? "Ready" : "No feed"}
            </span>
          </div>
          <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-xl bg-black">
            <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-white/30 text-sm">
              Camera feed is not configured for Phase 1 BLE control.
            </div>
            {/* floating telemetry widgets */}
            <div className="absolute left-3 top-3 space-y-1 text-[10px] text-white/80">
              <div className="rounded bg-black/60 px-2 py-1">Speed: {raw.SPEED ?? "—"} m/s</div>
              <div className="rounded bg-black/60 px-2 py-1">Heading: {raw.HEADING ?? "—"}°</div>
              <div className="rounded bg-black/60 px-2 py-1">Pitch: {raw.PITCH ?? "—"}°</div>
              <div className="rounded bg-black/60 px-2 py-1">Roll: {raw.ROLL ?? "—"}°</div>
            </div>
            <div className="absolute bottom-3 right-3 text-[10px] text-white/50">
              {new Date().toLocaleTimeString()}
            </div>
          </div>
        </div>

        {/* Lower workspace: map + joystick side by side */}
        <div className="grid grid-cols-2 gap-2 min-w-0">
          {/* Map */}
          <div className={`${panel} min-w-0`}>
            <div className="mb-2 text-xs font-semibold text-white/80">GPS / Map</div>
          <div className="h-36 min-w-0 overflow-hidden">
            <MapView
              center={[36.8065, 10.1815]}
              label={hasGps ? gps : "Rover position unavailable"}
              showMarker={hasGps}
            />
          </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-white/70">
              <div>Fix: {raw.GPS_FIX ?? "N/A"}</div>
              <div>Sats: {raw.SATS ?? "N/A"}</div>
              <div>Accuracy: {raw.GPS_ACC ?? "N/A"}</div>
              <div>Heading: {raw.HEADING ?? "N/A"}°</div>
            </div>
          </div>

          {/* Joystick */}
          <div className={panel}>
            <div className="mb-2 text-xs font-semibold text-white/80">Manual driving</div>
            <div className="flex items-center justify-between text-[10px] text-white/60 mb-2">
              <span>Mode: {state.safetyState}</span>
              <span>Authority: {state.authorized ? "Operator" : "None"}</span>
            </div>
            <div className="flex h-36 items-center justify-center">
              <div className="scale-75 sm:scale-90">
                <Joystick
                  disabled={!connected || state.safetyState !== "MANUAL"}
                  axes={state.axes}
                  onAxesChange={(f, t, a) => setAxes(f, t, a)}
                />
              </div>
            </div>
            <div className="mt-2 text-center text-[10px] text-white/60">
              Throttle: {state.axes.forward.toFixed(2)} · Steering: {state.axes.turn.toFixed(2)}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={() => (state.safetyState === "MANUAL" ? disarm() : arm())}
                className="rounded-xl bg-green-400/90 py-2 text-xs font-semibold text-deep"
              >
                {state.safetyState === "MANUAL" ? "Disarm" : "Arm → MANUAL"}
              </button>
              <button
                onClick={() => stop()}
                className="rounded-xl bg-red-500/90 py-2 text-xs font-semibold text-white"
              >
                EMERGENCY STOP
              </button>
            </div>
          </div>
        </div>

        {/* Battery + telemetry */}
        <div className="grid gap-3 lg:grid-cols-2">
          <div className={panel}>
            <div className="mb-2 text-xs font-semibold text-white/80">Battery</div>
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full ${battery !== null && battery < 20 ? "bg-red-400" : "bg-green-400"}`}
                  style={{ width: battery === null ? "0%" : `${Math.min(100, Math.max(0, battery))}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-white">
                {battery === null ? "—" : `${Math.round(battery)}%`}
              </span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-white/70">
              <div>Voltage: {readText(raw, "BATTERY_V", "—")} V</div>
              <div>Current: {readText(raw, "BATTERY_A", "—")} A</div>
              <div>Capacity: {readText(raw, "BATTERY_CAP", "N/A")}</div>
              <div>Status: {battery === null ? "Unavailable" : battery < 20 ? "Low" : "Healthy"}</div>
            </div>
          </div>

          <div className={panel}>
            <div className="mb-2 text-xs font-semibold text-white/80">Telemetry</div>
            <div className="grid grid-cols-2 gap-2 text-[10px] text-white/70">
              <div>IMU: {raw.IMU_VALIDITY ?? "unavailable"}</div>
              <div>Heading: {raw.HEADING ?? "—"}°</div>
              <div>Pitch: {raw.PITCH ?? "—"}°</div>
              <div>Roll: {raw.ROLL ?? "—"}°</div>
              <div>Enc L: {raw.ENC_L ?? "—"} </div>
              <div>Enc R: {raw.ENC_R ?? "—"}</div>
              <div>Motor: {raw.MOTOR ?? "—"} </div>
              <div>GPS: {raw.GPS_VALIDITY ?? "—"} </div>
            </div>
            <div className="mt-3">
              <Compass heading={heading} />
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts (desktop) */}
        <div className="hidden md:block">
          <div className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3 text-[10px] text-white/70">
            <div className="mb-1 font-semibold text-white/80">Keyboard shortcuts (AZERTY)</div>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              <span>Z / ↑ Forward</span>
              <span>S / ↓ Reverse</span>
              <span>Q / ← Left</span>
              <span>D / → Right</span>
              <span>Space Emergency stop</span>
              <span>Release Neutral</span>
            </div>
          </div>
        </div>

        {/* Telemetry cards */}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <GpsCard telemetry={state.telemetry} />
          <EnvironmentCard telemetry={state.telemetry} />
          <PowerCard telemetry={state.telemetry} />
          <CameraCard telemetry={state.telemetry} />
        </div>
      </div>

      {/* Right panel */}
      <aside className="space-y-3">
        <div className={panel}>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-white">RX</div>
            <div>
              <div className="text-sm font-semibold text-white">RoverX</div>
              <div className="text-[10px] text-white/50">TerraRover X1</div>
            </div>
          </div>
          <div className="mt-3 space-y-1 text-[10px] text-white/70">
            <div>ESP32: {connected ? "Connected" : "Disconnected"}</div>
            <div>Firmware: {raw.FW ?? "unknown"}</div>
            <div>BLE RSSI: {raw.RSSI ?? "N/A"}</div>
            <div>Last ACK: {state.lastAck ? `${state.lastAck.event} #${state.lastAck.sequence}` : "—"}</div>
            <div>Telemetry age: {telemetryAge === "—" ? "—" : `${telemetryAge} ms`}</div>
          </div>
        </div>

        <div className={panel}>
          <div className="mb-2 text-xs font-semibold text-white/80">Connection status</div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
            <span className="text-xs text-white/80">{connected ? "Connected" : "Disconnected"}</span>
          </div>
          <div className="mt-2 text-[10px] text-white/60">
            {connected ? "BLE link active" : "No communication"}
          </div>
        </div>

        <div className={panel}>
          <div className="mb-2 text-xs font-semibold text-white/80">Environmental telemetry</div>
          <div className="space-y-1 text-[10px] text-white/70">
            <div>Temp: {temp}°C</div>
            <div>Humidity: {humidity}%</div>
            <div>Wind: {wind}</div>
            <div>Pressure: {pressure}</div>
          </div>
        </div>

        <div className={panel}>
          <div className="mb-2 text-xs font-semibold text-white/80">Compass</div>
          <Compass heading={heading} />
        </div>
      </aside>
    </div>
  );
}
