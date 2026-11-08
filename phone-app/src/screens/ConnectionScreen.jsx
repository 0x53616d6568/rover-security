import { Battery, Signal, Wifi } from "lucide-react";
import { readNumber, readText } from "../components/readings";

const panel = "rounded-2xl border border-white/10 bg-white/[0.04] p-4";

export default function ConnectionScreen({ state, connected, connect, disconnect, toggleDemo, arm, disarm }) {
  const raw = state.telemetry?.raw ?? {};
  const battery = readNumber(raw, "BATTERY");

  return (
    <div className="space-y-4">
      <div className={`${panel} text-text-primary`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold">Connection</div>
            <div className="text-[10px] text-white/50">MQTT Cloud Link (Wi-Fi / HiveMQ)</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${connected ? "bg-green-400" : "bg-red-500"}`} />
            <span className="text-xs text-white/70">{connected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] text-white/50">Link status</div>
            <div className="text-sm font-semibold">{state.connectionStatus}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] text-white/50">Authorization</div>
            <div className="text-sm font-semibold">{state.authorized ? "Granted" : "None"}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] text-white/50">Safety state</div>
            <div
              className={`text-sm font-semibold ${
                state.safetyState === "MANUAL"
                  ? "text-green-400"
                  : state.safetyState === "FAULT"
                    ? "text-red-400"
                    : "text-white"
              }`}
            >
              {state.safetyState}
            </div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] text-white/50">Telemetry</div>
            <div className="text-sm font-semibold">{state.telemetry ? "Live" : "—"}</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={toggleDemo}
            className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-text-primary hover:bg-white/15"
          >
            {state.demoMode ? "Demo on" : "Demo off"}
          </button>
          <button
            onClick={() => (connected ? disconnect() : connect())}
            disabled={state.connectionStatus === "connecting"}
            className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-text-primary hover:bg-white/15 disabled:opacity-40"
          >
            {state.connectionStatus === "connecting"
              ? "Connecting…"
              : connected
                ? "Disconnect"
                : "Connect"}
          </button>
          <button
            onClick={() => (state.safetyState === "MANUAL" ? disarm() : arm())}
            disabled={!connected}
            className="rounded-full bg-green-400/90 px-4 py-2 text-xs font-semibold text-deep disabled:opacity-40"
          >
            {state.safetyState === "MANUAL" ? "Disarm" : "Arm → MANUAL"}
          </button>
        </div>

        {state.connectionError && (
          <p className="mt-3 text-xs text-red-300">{state.connectionError}</p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`${panel} text-text-primary`}>
          <div className="text-sm font-semibold">BLE contract</div>
          <p className="mt-2 text-xs text-white/60">
            Service 8f4d0001 · Command 8f4d0002 · Status 8f4d0003. Commands are bounded ASCII frames. Status notifications are authoritative.
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-white/70">
            <Signal size={14} />
            <span>RSSI: {readText(raw, "RSSI", "N/A")}</span>
            <Wifi size={14} />
            <span>BLE</span>
            <Battery size={14} />
            <span>{battery === null ? "—" : `${Math.round(battery)}%`}</span>
          </div>
        </div>

        <div className={`${panel} text-text-primary`}>
          <div className="text-sm font-semibold">Device info</div>
          <div className="mt-2 space-y-1 text-xs text-white/70">
            <div>Rover: TerraRover X1</div>
            <div>Firmware: {readText(raw, "FW", "unknown")}</div>
            <div>Last ACK: {state.lastAck ? `${state.lastAck.event} #${state.lastAck.sequence}` : "—"}</div>
            <div>Telemetry age: {readText(raw, "AGE_MS", "—") === "—" ? "—" : `${readText(raw, "AGE_MS", "—")} ms`}</div>
          </div>
        </div>
      </div>
    </div>
  );
}