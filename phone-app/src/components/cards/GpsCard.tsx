import type { RoverTelemetry } from "../../protocol/types";

interface GpsCardProps {
  telemetry?: RoverTelemetry;
}

export function GpsCard({ telemetry }: GpsCardProps) {
  const validity = telemetry?.raw.GPS_VALIDITY ?? telemetry?.sensorData ?? "unavailable";
  const value = telemetry?.raw.GPS ?? "—";
  return (
    <section className="card">
      <div className="card-title">
        <h3>GPS</h3>
        <span className={`pill ${validity === "available" ? "ok" : validity === "simulated" ? "warn" : "neutral"}`}>
          {validity}
        </span>
      </div>
      <div className="reading">
        <span className="label">Fix / coordinates</span>
        <span className={`value ${validity}`}>{value}</span>
      </div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 8 }}>
        Informational in Phase 1. Requires a valid fix and age.
      </p>
    </section>
  );
}
