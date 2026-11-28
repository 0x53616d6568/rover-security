import type { ReactNode } from "react";

import { cn } from "../lib/cn";

type Validity = "available" | "unavailable" | "invalid" | "stale" | "simulated" | (string & {});

interface MetricProps {
  label: string;
  value: ReactNode;
  unit?: string;
  validity?: Validity;
  hint?: ReactNode;
  className?: string;
}

function normalize(value: ReactNode): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "" && value !== "—";
  if (typeof value === "number") return Number.isFinite(value);
  return true;
}

export function Metric({
  label,
  value,
  unit,
  validity = "unavailable",
  hint,
  className,
}: MetricProps) {
  const present = normalize(value);
  const state = present ? validity : "unavailable";

  return (
    <div className={cn("reading", state, className)}>
      <span className="label">{label}</span>
      <span className="value">
        {present ? value : "—"}
        {present && unit && <span className="unit"> {unit}</span>}
      </span>
      {hint && <span className="text-[10px] leading-snug text-ink-faint">{hint}</span>}
    </div>
  );
}
