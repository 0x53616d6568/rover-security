import TelemetryCard from "./TelemetryCard";

export default function ImuCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  return <TelemetryCard label="IMU heading" value={raw.HEADING ?? "—"} validity={raw.IMU_VALIDITY ?? "unavailable"} />;
}
