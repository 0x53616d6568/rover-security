import type { RoverTelemetry } from "../../protocol/types";

interface EnvironmentCardProps {
  telemetry?: RoverTelemetry;
}

export function EnvironmentCard({ telemetry }: EnvironmentCardProps) {
  const validity = telemetry?.raw.ENV_VALIDITY ?? telemetry?.sensorData ?? "unavailable";
  const temp = telemetry?.raw.TEMP ?? "—";
  const humidity = telemetry?.raw.HUMIDITY ?? "—";
  return (
    <section className="card">
      <div className="card-title">
        <h3>Environment</h3>
        <span className={`pill ${validity === "available" ? "ok" : validity === "simulated" ? "warn" : "neutral"}`}>
          {validity}
        </span>
      </div>
      <div className="grid grid-2">
        <div className="reading">
          <span className="label">Temperature</span>
          <span className={`value ${validity}`}>{temp}</span>
        </div>
        <div className="reading">
          <span className="label">Humidity</span>
          <span className={`value ${validity}`}>{humidity}</span>
        </div>
      </div>
    </section>
  );
}
