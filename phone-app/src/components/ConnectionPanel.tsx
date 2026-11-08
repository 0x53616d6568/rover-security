import type { ConnectionStatus } from "../protocol/types";

interface ConnectionPanelProps {
  status: ConnectionStatus;
  supported: boolean;
  supportMessage: string;
  error?: string;
  authorized: boolean;
  lastEvent?: string;
  lastSequence?: number;
  telemetryAge?: string;
  onClearError: () => void;
}

export function ConnectionPanel({
  status,
  supported,
  supportMessage,
  error,
  authorized,
  lastEvent,
  lastSequence,
  telemetryAge,
  onClearError,
}: ConnectionPanelProps) {
  return (
    <section className="card" aria-labelledby="connection-title">
      <div className="card-title">
        <h3 id="connection-title">BLE link &amp; safety</h3>
        <span className="meta">local only</span>
      </div>
      {!supported && (
        <div className="banner" role="alert">
          {supportMessage}
        </div>
      )}
      {error && (
        <div className="banner" role="alert">
          {error}
          <div style={{ marginTop: 8 }}>
            <button className="btn ghost" type="button" onClick={onClearError}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="grid grid-2">
        <div className="reading">
          <span className="label">Link status</span>
          <span className="value">{status}</span>
        </div>
        <div className="reading">
          <span className="label">Authorization</span>
          <span className="value">{authorized ? "granted" : "none"}</span>
        </div>
        <div className="reading">
          <span className="label">Last rover event</span>
          <span className="value" style={{ fontSize: 16 }}>
            {lastEvent ?? "—"}
          </span>
        </div>
        <div className="reading">
          <span className="label">Last sequence</span>
          <span className="value">{lastSequence ?? "—"}</span>
        </div>
        <div className="reading">
          <span className="label">Telemetry age</span>
          <span className="value">{telemetryAge ?? "—"}</span>
        </div>
      </div>
      <p style={{ color: "var(--mut)", fontSize: 12, marginTop: 12 }}>
        {supportMessage}
      </p>
    </section>
  );
}
