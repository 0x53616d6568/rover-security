import { useRef, useState } from "react";

interface ControlPadProps {
  disabled: boolean;
  axes: { forward: number; turn: number };
  onAxesChange: (forward: number, turn: number, active: boolean) => void;
}

export function ControlPad({ disabled, axes, onAxesChange }: ControlPadProps) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const reset = () => {
    setKnob({ x: 0, y: 0 });
    setDragging(false);
    onAxesChange(0, 0, false);
  };

  const updateFromPointer = (clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const radius = rect.width / 2 - 28;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const distance = Math.hypot(dx, dy);
    if (distance > radius) {
      dx = (dx / distance) * radius;
      dy = (dy / distance) * radius;
    }
    setKnob({ x: dx, y: dy });
    const forward = -dy / radius;
    const turn = dx / radius;
    onAxesChange(forward, turn, true);
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || disabled) return;
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerUp = () => {
    if (dragging) reset();
  };

  return (
    <section className="card" aria-labelledby="control-title">
      <div className="card-title">
        <h3 id="control-title">Manual drive</h3>
        <span className="meta">
          {disabled ? "disabled" : dragging ? "active" : "idle"}
        </span>
      </div>
      <div
        ref={padRef}
        className={`joystick ${disabled ? "disabled" : ""} ${dragging ? "dragging" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        role="application"
        aria-label="Joystick control"
      >
        <div className="axis x" />
        <div className="axis y" />
        <div
          className="knob"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        />
      </div>
      <div className="grid grid-2" style={{ marginTop: 14 }}>
        <div className="reading">
          <span className="label">Forward</span>
          <span className="value">{axes.forward.toFixed(2)}</span>
        </div>
        <div className="reading">
          <span className="label">Turn</span>
          <span className="value">{axes.turn.toFixed(2)}</span>
        </div>
      </div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 10 }}>
        Push and hold to drive. Release to stop. Commands are bounded to ±1.0.
      </p>
    </section>
  );
}
