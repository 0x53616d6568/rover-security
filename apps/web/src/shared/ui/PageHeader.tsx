import type { ReactNode } from "react";

import { cn } from "../lib/cn";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <div className="micro-label flex items-center gap-2">
          <span className="inline-block h-px w-5 bg-accent/70" aria-hidden="true" />
          {eyebrow}
        </div>
        <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-[28px]">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
        {meta && <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
