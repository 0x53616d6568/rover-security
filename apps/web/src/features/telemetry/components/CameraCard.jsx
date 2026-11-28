import TelemetryCard from "./TelemetryCard";
import { readText } from "../../../shared/lib/readings";

export default function CameraCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  return (
    <TelemetryCard
      label="Camera"
      value={readText(raw, "CAMERA", "not configured")}
      validity={raw.CAMERA_VALIDITY ?? "unavailable"}
    >
      <dl className="flex justify-between gap-2 text-[11px]">
        <dt className="text-ink-faint">Storage</dt>
        <dd className="data-value text-ink-muted">{readText(raw, "STORAGE", "unavailable")}</dd>
      </dl>
    </TelemetryCard>
  );
}
