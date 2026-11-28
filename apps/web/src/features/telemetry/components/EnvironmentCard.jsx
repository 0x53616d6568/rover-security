import TelemetryCard from "./TelemetryCard";
import { readText } from "../../../shared/lib/readings";

export default function EnvironmentCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  const temperature = readText(raw, "TEMP", "—");
  const humidity = readText(raw, "HUMIDITY", "—");
  const pressure = readText(raw, "PRESSURE", "—");
  const wind = readText(raw, "WIND", "—");

  return (
    <TelemetryCard
      label="Environment"
      value={`${temperature}°C / ${humidity}%`}
      validity={raw.ENV_VALIDITY ?? "unavailable"}
    >
      <dl className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="flex justify-between gap-2">
          <dt className="text-ink-faint">Pressure</dt>
          <dd className="data-value text-ink-muted">{pressure}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-ink-faint">Wind</dt>
          <dd className="data-value text-ink-muted">{wind}</dd>
        </div>
      </dl>
    </TelemetryCard>
  );
}
