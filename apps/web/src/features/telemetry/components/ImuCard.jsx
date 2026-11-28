import TelemetryCard from "./TelemetryCard";
import { readText } from "../../../shared/lib/readings";

export default function ImuCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  return (
    <TelemetryCard label="IMU heading" value={readText(raw, "HEADING", "—")} unit="°" validity={raw.IMU_VALIDITY ?? "unavailable"}>
      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-faint">Pitch</dt>
          <dd className="data-value text-ink-muted">{readText(raw, "PITCH", "—")}°</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-faint">Roll</dt>
          <dd className="data-value text-ink-muted">{readText(raw, "ROLL", "—")}°</dd>
        </div>
      </dl>
    </TelemetryCard>
  );
}
