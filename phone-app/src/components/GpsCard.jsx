import TelemetryCard from "./TelemetryCard";
import MapView from "./MapView";
import { readText } from "./readings";

export default function GpsCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  const gps = readText(raw, "GPS", "Unavailable");
  const hasFix = Boolean(raw.GPS);
  return (
    <div className="space-y-2">
      <div className="h-40">
        <MapView
          center={[36.8065, 10.1815]}
          label={hasFix ? gps : "Rover position unavailable"}
          showMarker={hasFix}
        />
      </div>
      <TelemetryCard
        label="GPS"
        value={gps}
        validity={raw.GPS_VALIDITY ?? (hasFix ? "available" : "unavailable")}
      />
    </div>
  );
}
