import type { RoverTelemetry } from "../../protocol/types";

interface CameraCardProps {
  telemetry?: RoverTelemetry;
}

export function CameraCard({ telemetry }: CameraCardProps) {
  const status = telemetry?.raw.CAMERA ?? "unavailable";
  const storage = telemetry?.raw.STORAGE ?? "unavailable";
  const lastCapture = telemetry?.raw.LAST_CAPTURE ?? "—";
  return (
    <section className="card">
      <div className="card-title">
        <h3>Camera &amp; storage</h3>
        <span className="meta">capture only</span>
      </div>
      <div className="grid grid-2">
        <div className="reading">
          <span className="label">Camera</span>
          <span className="value">{status}</span>
        </div>
        <div className="reading">
          <span className="label">Storage</span>
          <span className="value">{storage}</span>
        </div>
        <div className="reading" style={{ gridColumn: "1 / -1" }}>
          <span className="label">Last capture</span>
          <span className="value" style={{ fontSize: 16 }}>
            {lastCapture}
          </span>
        </div>
      </div>
    </section>
  );
}
