import TelemetryCard from "./TelemetryCard";
import { readText } from "./readings";

export default function EnvironmentCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  const temperature = readText(raw, "TEMP", "—");
  const humidity = readText(raw, "HUMIDITY", "—");
  return (
    <TelemetryCard
      label="Environment"
      value={`${temperature}°C / ${humidity}%`}
      validity={raw.ENV_VALIDITY ?? "unavailable"}
    />
  );
}
