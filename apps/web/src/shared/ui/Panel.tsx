import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

export function Panel({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...rest} />;
}

interface PanelHeaderProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PanelHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="micro-label">{eyebrow}</div>}
        <h2 className="mt-1 text-sm font-semibold leading-snug text-ink">{title}</h2>
        {description && (
          <p className="mt-1 max-w-prose text-xs leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
