import GpsCard from "./components/GpsCard";
import ImuCard from "./components/ImuCard";
import EnvironmentCard from "./components/EnvironmentCard";
import PowerCard from "./components/PowerCard";
import CameraCard from "./components/CameraCard";
import { formatAge } from "../../protocol/telemetry";
import { PageHeader, Panel, PanelHeader, StatusPill, EmptyState } from "../../shared/ui";

const severityTone = {
  info: "text-ink-muted",
  warn: "text-accent",
  error: "text-danger",
};

export default function TelemetryScreen({ state }) {
  const telemetry = state.telemetry;
  const age = telemetry ? formatAge(telemetry.ageMs, telemetry.receivedAt) : "—";
  const validity = telemetry?.sensorData ?? "unavailable";
  const validityPillTone =
    validity === "available" ? "live" : validity === "invalid" ? "danger" : validity === "stale" ? "warn" : "neutral";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sensor bus"
        title="Telemetry"
        description="Read-only status published by the rover. Missing, invalid, and stale readings stay visibly marked — the console never fills them in."
        meta={
          <>
            <StatusPill tone={validityPillTone} label={`Sensors ${validity}`} dot={false} />
            <StatusPill tone="neutral" label={`Age ${age}`} dot={false} title="Time since the last telemetry frame" />
            <StatusPill tone="neutral" label={`Frame ${telemetry?.lastSequence ?? "—"}`} dot={false} />
          </>
        }
      />

      {!telemetry ? (
        <EmptyState
          title="No telemetry received yet"
          description="Connect the rover and confirm the telemetry MQTT link. Until a frame arrives, every reading is unavailable."
        />
      ) : (
        <>
          <GpsCard telemetry={telemetry} />

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <ImuCard telemetry={telemetry} />
            <EnvironmentCard telemetry={telemetry} />
            <PowerCard telemetry={telemetry} />
            <CameraCard telemetry={telemetry} />
          </div>
        </>
      )}

      <Panel>
        <div className="p-4">
          <PanelHeader
            eyebrow="Event log"
            title="Recent rover events"
            description="Newest first. Heartbeats are suppressed; faults and rejections are never hidden."
          />
        </div>
        {state.events.length === 0 ? (
          <div className="px-4 pb-4">
            <EmptyState title="No events yet" description="Connection, arming, command, and fault events appear here." />
          </div>
        ) : (
          <ul className="event-list">
            {state.events.map((event) => (
              <li key={event.id}>
                <span className="time">{new Date(event.time).toLocaleTimeString()}</span>
                <span className={`msg ${severityTone[event.severity] ?? "text-ink-muted"}`}>{event.message}</span>
                <span className="time uppercase">{event.severity}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
