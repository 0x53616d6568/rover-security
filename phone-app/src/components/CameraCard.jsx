import TelemetryCard from "./TelemetryCard";
import { readText } from "./readings";

export default function CameraCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  return (
    <>
      <TelemetryCard
        label="Camera"
        value={readText(raw, "CAMERA", "not configured")}
        validity={raw.CAMERA_VALIDITY ?? "unavailable"}
      />
      <TelemetryCard
        label="Storage"
        value={readText(raw, "STORAGE", "unavailable")}
        validity={raw.STORAGE_VALIDITY ?? "unavailable"}
      />
    </>
  );
}
