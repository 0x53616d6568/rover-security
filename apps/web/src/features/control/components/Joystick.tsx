import { useRef, useState } from "react";

interface JoystickProps {
  disabled: boolean;
  axes: { forward: number; turn: number };
  onAxesChange: (forward: number, turn: number, active: boolean) => void;
}

export default function Joystick({ disabled, axes, onAxesChange }: JoystickProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const reset = () => {
    setKnob({ x: 0, y: 0 });
    setDragging(false);
    onAxesChange(0, 0, false);
  };

  const update = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2 - 24;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    setKnob({ x: dx, y: dy });
    onAxesChange(-dy / radius, dx / radius, true);
  };

  return (
    <div
      ref={padRef}
      role="application"
      aria-label="Driving joystick. Drag to set throttle and steering."
      onPointerDown={(event) => {
        if (disabled) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
        update(event.clientX, event.clientY);
      }}
      onPointerMove={(event) => {
        if (dragging && !disabled) update(event.clientX, event.clientY);
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
      className={`relative mx-auto h-44 w-44 touch-none select-none rounded-full border border-line-strong bg-bg-elevated shadow-panel sm:h-64 sm:w-64 ${
        disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing"
      }`}
    >
      <div className="absolute inset-3 rounded-full border border-line" aria-hidden="true" />
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(233,180,76,0.10), transparent 68%)" }}
        aria-hidden="true"
      />
      <div className="absolute left-1/2 top-1/2 h-px w-3/4 -translate-x-1/2 bg-line-strong" aria-hidden="true" />
      <div className="absolute left-1/2 top-1/2 h-3/4 w-px -translate-y-1/2 bg-line-strong" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-strong/60 bg-accent shadow-[0_0_24px_rgba(233,180,76,0.35)] transition-transform duration-75"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        aria-hidden="true"
      />
      {!dragging && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-pill bg-bg/70 px-2 py-0.5 font-mono text-[10px] text-ink-faint">
          {axes.forward.toFixed(2)} · {axes.turn.toFixed(2)}
        </div>
      )}
    </div>
  );
}
