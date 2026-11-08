import TelemetryCard from "./TelemetryCard";
import { readText } from "./readings";

export default function PowerCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  const voltage = readText(raw, "BATTERY_V", "—");
  return (
    <TelemetryCard
      label="Power"
      value={`${voltage} V`}
      validity={raw.BATTERY_VALIDITY ?? (raw.BATTERY_V ? "available" : "unavailable")}
    />
  );
}
