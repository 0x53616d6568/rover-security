import type { InputHTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/cn";

interface FieldProps {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, children, className }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="micro-label text-ink-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] leading-relaxed text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-sm border border-line bg-bg-elevated px-3 text-sm text-ink placeholder:text-ink-faint transition-colors duration-150 disabled:opacity-40",
        "focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/15",
        className,
      )}
      {...rest}
    />
  );
}
