import type { RoverTelemetry } from "../../protocol/types";

interface PowerCardProps {
  telemetry?: RoverTelemetry;
}

export function PowerCard({ telemetry }: PowerCardProps) {
  const validity = telemetry?.raw.BATTERY_VALIDITY ?? "unavailable";
  const voltage = telemetry?.raw.BATTERY_V ?? "—";
  const current = telemetry?.raw.BATTERY_A ?? "—";
  return (
    <section className="card">
      <div className="card-title">
        <h3>Power</h3>
        <span className={`pill ${validity === "available" ? "ok" : validity === "simulated" ? "warn" : "neutral"}`}>
          {validity}
        </span>
      </div>
      <div className="grid grid-2">
        <div className="reading">
          <span className="label">Battery voltage</span>
          <span className={`value ${validity}`}>{voltage}</span>
        </div>
        <div className="reading">
          <span className="label">Current</span>
          <span className={`value ${validity}`}>{current}</span>
        </div>
      </div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 8 }}>
        Shown only when instrumented and valid. Missing readings are never shown as zero.
      </p>
    </section>
  );
}
