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
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (dragging && !disabled) update(e.clientX, e.clientY);
      }}
      onPointerUp={reset}
      onPointerCancel={reset}
      className={`relative mx-auto h-44 w-44 sm:h-64 sm:w-64 touch-none select-none rounded-full border border-white/20 bg-white/5 backdrop-blur-xl shadow-[0_0_40px_rgba(74,222,128,0.1)] ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}`}
    >
      <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(74,222,128,0.12),transparent_70%)]" />
      <div className="absolute left-1/2 top-1/2 h-px w-3/4 -translate-x-1/2 bg-white/20" />
      <div className="absolute left-1/2 top-1/2 h-3/4 w-px -translate-y-1/2 bg-white/20" />
      <div
        className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-green-300 to-green-500 shadow-[0_0_20px_rgba(74,222,128,0.6)] transition-transform"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
      {!dragging && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] text-text-secondary">
          {axes.forward.toFixed(2)}, {axes.turn.toFixed(2)}
        </div>
      )}
    </div>
  );
}
