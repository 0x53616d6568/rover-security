import { StatusPill } from "../../../shared/ui";
import { validityTone } from "../../../shared/lib/readings";

/**
 * Shared telemetry tile. `value` is rendered exactly as supplied: the UI never
 * substitutes a fabricated reading when the rover reports nothing.
 */
export default function TelemetryCard({ label, value, unit, validity = "unavailable", children }) {
  const tone = validityTone(validity);
  return (
    <div className="panel flex h-full flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="micro-label">{label}</div>
        <StatusPill tone={tone} label={validity} dot={false} />
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="data-value text-xl font-medium text-ink">{value}</span>
        {unit && <span className="font-mono text-[11px] text-ink-muted">{unit}</span>}
      </div>
      {children && <div className="mt-3 border-t border-line pt-3">{children}</div>}
    </div>
  );
}
