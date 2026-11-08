import type { RoverTelemetry } from "../../protocol/types";

interface ImuCardProps {
  telemetry?: RoverTelemetry;
}

export function ImuCard({ telemetry }: ImuCardProps) {
  const validity = telemetry?.raw.IMU_VALIDITY ?? telemetry?.sensorData ?? "unavailable";
  const heading = telemetry?.raw.HEADING ?? "—";
  const rate = telemetry?.raw.IMU_RATE ?? "—";
  return (
    <section className="card">
      <div className="card-title">
        <h3>Heading / IMU</h3>
        <span className={`pill ${validity === "available" ? "ok" : validity === "simulated" ? "warn" : "neutral"}`}>
          {validity}
        </span>
      </div>
      <div className="grid grid-2">
        <div className="reading">
          <span className="label">Heading</span>
          <span className={`value ${validity}`}>{heading}</span>
        </div>
        <div className="reading">
          <span className="label">Angular rate</span>
          <span className={`value ${validity}`}>{rate}</span>
        </div>
      </div>
    </section>
  );
}
