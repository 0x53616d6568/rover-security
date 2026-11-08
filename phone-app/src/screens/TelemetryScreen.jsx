import GpsCard from "../components/GpsCard";
import ImuCard from "../components/ImuCard";
import EnvironmentCard from "../components/EnvironmentCard";
import PowerCard from "../components/PowerCard";
import CameraCard from "../components/CameraCard";

const glass = "bg-white/5 border border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(8,13,11,0.25)]";

export default function TelemetryScreen({ state }) {
  return (
    <div className="space-y-4">
      <GpsCard telemetry={state.telemetry} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ImuCard telemetry={state.telemetry} />
        <EnvironmentCard telemetry={state.telemetry} />
        <PowerCard telemetry={state.telemetry} />
        <CameraCard telemetry={state.telemetry} />
      </div>

      <div className={`${glass} rounded-3xl p-4 text-text-primary`}>
        <div className="mb-3 text-sm font-semibold">Recent events</div>
        {state.events.length === 0 ? (
          <p className="text-xs text-text-secondary">No events yet.</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-auto">
            {state.events.map((e) => (
              <li key={e.id} className="flex items-start gap-2 rounded-xl bg-white/5 p-2 text-xs">
                <span className="text-text-secondary">{new Date(e.time).toLocaleTimeString()}</span>
                <span className="text-text-primary">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
