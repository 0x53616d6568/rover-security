import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Settings } from "lucide-react";

import { useRover } from "./app/useRover";
import { formatAge } from "./protocol/telemetry";
import WelcomeScreen from "./screens/WelcomeScreen";
import ConnectionScreen from "./screens/ConnectionScreen";
import CockpitScreen from "./screens/CockpitScreen";
import TelemetryScreen from "./screens/TelemetryScreen";
import CameraScreen from "./screens/CameraScreen";
import HelpScreen from "./screens/HelpScreen";

const glass = "bg-white/5 border border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(8,13,11,0.25)]";

const tabs = [
  { id: "welcome", label: "Welcome" },
  { id: "connection", label: "Connection" },
  { id: "control", label: "Control" },
  { id: "telemetry", label: "Telemetry" },
  { id: "camera", label: "Camera" },
  { id: "help", label: "Help" },
];

export default function App() {
  const { state, connect, disconnect, arm, disarm, stop, setAxes, toggleDemo } = useRover();
  const [tab, setTab] = useState("welcome");

  useEffect(() => {
    if (state.connectionStatus === "connected") setTab("control");
  }, [state.connectionStatus]);
  const connected = state.connectionStatus === "connected";
  const commandOnline = state.links.command;
  const commandLabel = commandOnline
    ? "CMD online"
    : state.connectionStatus === "connecting"
      ? "CMD connecting"
      : "CMD offline";
  const commandChip = commandOnline
    ? "border-green-500/40 bg-green-950/40 text-green-400"
    : state.connectionStatus === "connecting"
      ? "border-amber-500/40 bg-amber-950/40 text-amber-300"
      : "border-red-500/40 bg-red-950/40 text-red-400";
  const telemetryAge = state.telemetry ? formatAge(state.telemetry.ageMs, state.telemetry.receivedAt) : "—";

  if (tab === "control") {
    return (
      <CockpitScreen
        state={state}
        connected={connected}
        arm={arm}
        disarm={disarm}
        stop={stop}
        setAxes={setAxes}
        onNavigate={setTab}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/20">
              <span className="text-xs font-bold text-text-primary">E</span>
            </div>
            <span className="text-sm font-semibold tracking-wide text-white">RoverX Console</span>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${tab === t.id ? "bg-deep/10 text-white" : "text-white/70 hover:bg-deep/5"}`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div
              className={`hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold sm:flex ${commandChip}`}
              title="Command MQTT link status"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${commandOnline ? "bg-green-400" : "bg-current"}`} />
              {commandLabel}
            </div>
            <button
              onClick={() => setTab("connection")}
              className={`${glass} flex h-9 w-9 items-center justify-center rounded-full text-text-primary`}
              title="Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24">
        <AnimatePresence mode="wait">
          {tab === "welcome" && (
            <motion.div key="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <WelcomeScreen onLaunch={() => setTab("connection")} />
            </motion.div>
          )}
          {tab === "connection" && (
            <motion.div key="connection" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ConnectionScreen
                state={state}
                connected={connected}
                connect={connect}
                disconnect={disconnect}
                toggleDemo={toggleDemo}
                arm={arm}
                disarm={disarm}
              />
            </motion.div>
          )}
          {tab === "control" && (
            <motion.div key="control" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CockpitScreen
                state={state}
                connected={connected}
                arm={arm}
                disarm={disarm}
                stop={stop}
                setAxes={setAxes}
                onNavigate={setTab}
              />
            </motion.div>
          )}
          {tab === "telemetry" && (
            <motion.div key="telemetry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TelemetryScreen state={state} />
            </motion.div>
          )}
          {tab === "camera" && (
            <motion.div key="camera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CameraScreen state={state} />
            </motion.div>
          )}
          {tab === "help" && (
            <motion.div key="help" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <HelpScreen />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 text-center text-xs text-white/60">
          Telemetry age: {telemetryAge} · Safety state: {state.safetyState} · Command MQTT:{" "}
          <span className={commandOnline ? "text-green-400" : "text-red-400"}>
            {commandOnline ? "online" : "offline"}
          </span>
        </div>
      </main>

      <nav className="sticky bottom-0 z-50 border-t border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-4 py-3">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-xl px-4 py-2 text-xs font-semibold ${tab === id ? "bg-deep/10 text-white" : "text-white/70"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
