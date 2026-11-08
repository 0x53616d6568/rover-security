interface ArmStopPanelProps {
  safetyState: string;
  armPending: boolean;
  canArm: boolean;
  onArm: () => void;
  onDisarm: () => void;
  onStop: () => void;
}

export function ArmStopPanel({
  safetyState,
  armPending,
  canArm,
  onArm,
  onDisarm,
  onStop,
}: ArmStopPanelProps) {
  const armed = safetyState === "MANUAL";
  return (
    <section className="card" aria-labelledby="arm-title">
      <div className="card-title">
        <h3 id="arm-title">Arm / stop</h3>
        <span className="meta">explicit actions</span>
      </div>
      <div className="grid" style={{ gap: 10 }}>
        {armed ? (
          <button className="btn" type="button" onClick={onDisarm}>
            Disarm
          </button>
        ) : (
          <button
            className="btn primary"
            type="button"
            onClick={onArm}
            disabled={!canArm || armPending}
          >
            {armPending ? "Arming…" : "Arm → MANUAL"}
          </button>
        )}
        <button className="stop-button" type="button" onClick={onStop} disabled={!canArm}>
          SOFTWARE STOP
        </button>
      </div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 10 }}>
        Software STOP is a separate control from the physical motor cut-off on the rover.
      </p>
    </section>
  );
}
