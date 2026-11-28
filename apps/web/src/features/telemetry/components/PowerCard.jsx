import TelemetryCard from "./TelemetryCard";
import { readNumber, readText } from "../../../shared/lib/readings";

export default function PowerCard({ telemetry }) {
  const raw = telemetry?.raw ?? {};
  const voltage = readText(raw, "BATTERY_V", "—");
  const battery = readNumber(raw, "BATTERY");
  const current = readText(raw, "BATTERY_A", "—");

  return (
    <TelemetryCard
      label="Power"
      value={`${voltage} V`}
      validity={raw.BATTERY_VALIDITY ?? (raw.BATTERY_V ? "available" : "unavailable")}
    >
      <div className="space-y-2">
        <div className="h-1.5 overflow-hidden rounded-pill bg-surface-3">
          <div
            className={`h-full rounded-pill ${battery !== null && battery < 20 ? "bg-danger" : "bg-live"}`}
            style={{ width: battery === null ? "0%" : `${Math.min(100, Math.max(0, battery))}%` }}
          />
        </div>
        <dl className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-faint">Charge</dt>
            <dd className="data-value text-ink-muted">{battery === null ? "—" : `${Math.round(battery)}%`}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-faint">Current</dt>
            <dd className="data-value text-ink-muted">{current} A</dd>
          </div>
        </dl>
      </div>
    </TelemetryCard>
  );
}
