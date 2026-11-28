import MapView from "./MapView";
import { readText } from "../../../shared/lib/readings";
import { Panel, PanelHeader, StatusPill } from "../../../shared/ui";

export default function GpsCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  const gps = readText(raw, "GPS", "Unavailable");
  const hasFix = Boolean(raw.GPS);
  const validity = raw.GPS_VALIDITY ?? (hasFix ? "available" : "unavailable");

  return (
    <Panel className="overflow-hidden">
      <div className="p-4 pb-3">
        <PanelHeader
          eyebrow="Position"
          title="GPS fix"
          description={hasFix ? gps : "No position reported by the rover."}
          actions={<StatusPill tone={validity === "available" ? "live" : "neutral"} label={validity} dot={false} />}
        />
      </div>
      <div className="h-48 border-y border-line">
        <MapView
          center={[36.8065, 10.1815]}
          label={hasFix ? gps : "Rover position unavailable"}
          showMarker={hasFix}
        />
      </div>
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        <div className="reading">
          <span className="label">Fix</span>
          <span className="value">{readText(raw, "GPS_FIX", "—")}</span>
        </div>
        <div className="reading">
          <span className="label">Satellites</span>
          <span className="value">{readText(raw, "SATS", "—")}</span>
        </div>
        <div className="reading">
          <span className="label">Accuracy</span>
          <span className="value">{readText(raw, "GPS_ACC", "—")}</span>
        </div>
        <div className="reading">
          <span className="label">Heading</span>
          <span className="value">
            {readText(raw, "HEADING", "—")}
            {readText(raw, "HEADING", "") !== "" && <span className="unit"> °</span>}
          </span>
        </div>
      </div>
    </Panel>
  );
}
