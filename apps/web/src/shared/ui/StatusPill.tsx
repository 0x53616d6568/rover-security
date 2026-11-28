import type { ReactNode } from "react";

import { cn } from "../lib/cn";

export type PillTone = "live" | "warn" | "danger" | "neutral" | "info";

const tones: Record<PillTone, string> = {
  live: "border-live-line bg-live-soft text-live",
  warn: "border-accent/40 bg-accent-soft text-accent",
  danger: "border-danger-line bg-danger-soft text-danger",
  neutral: "border-line bg-surface-2 text-ink-muted",
  info: "border-info/40 bg-info-soft text-info",
};

const dots: Record<PillTone, string> = {
  live: "bg-live",
  warn: "bg-accent",
  danger: "bg-danger",
  neutral: "bg-ink-faint",
  info: "bg-info",
};

interface StatusPillProps {
  tone?: PillTone;
  label: ReactNode;
  dot?: boolean;
  pulse?: boolean;
  title?: string;
  className?: string;
}

export function StatusPill({
  tone = "neutral",
  label,
  dot = true,
  pulse = false,
  title,
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.1em]",
        tones[tone],
        className,
      )}
      title={title}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          {pulse && (
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", dots[tone])} />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dots[tone])} />
        </span>
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}
