import type { ButtonHTMLAttributes } from "react";

import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "live" | "stop";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-accent/70 bg-accent text-accent-ink hover:bg-accent-strong hover:border-accent-strong",
  secondary:
    "border border-line bg-surface-2 text-ink hover:border-line-strong hover:bg-surface-3",
  ghost:
    "border border-transparent bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink",
  danger:
    "border border-danger/60 bg-danger text-[#1c0705] hover:brightness-110",
  live:
    "border border-live/60 bg-live text-[#04140d] hover:brightness-110",
  stop:
    "border border-danger-line bg-danger-soft text-danger hover:bg-danger hover:text-white",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[10px]",
  md: "h-10 px-4 text-[11px]",
  lg: "h-12 px-6 text-xs",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-sm font-mono font-medium uppercase tracking-[0.12em] transition-colors duration-150 ease-out disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    />
  );
}
