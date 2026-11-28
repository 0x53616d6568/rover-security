import type { ReactNode } from "react";

import { cn } from "../lib/cn";

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border border-dashed border-line px-4 py-5",
        className,
      )}
    >
      <p className="text-sm font-medium text-ink-muted">{title}</p>
      {description && <p className="max-w-prose text-xs leading-relaxed text-ink-faint">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
