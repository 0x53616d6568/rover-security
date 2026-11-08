import type { ConnectionStatus } from "../protocol/types";

interface TopBarProps {
  demoMode: boolean;
  connectionStatus: ConnectionStatus;
  supported: boolean;
  onToggleDemo: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  unsupported: "Unsupported",
  idle: "Idle",
  connecting: "Connecting",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
};

export function TopBar({
  demoMode,
  connectionStatus,
  supported,
  onToggleDemo,
  onConnect,
  onDisconnect,
}: TopBarProps) {
  const connected = connectionStatus === "connected";
  return (
    <header className="topbar">
      <div className="hero" style={{ margin: 0 }}>
        <div className="brand-mark" aria-hidden="true">
          E
        </div>
        <div>
          <p className="kick">ENISOLAR · ROVER · PHASE 1</p>
          <h1>Operator console</h1>
          <p>Local BLE control surface. The ESP32 remains the safety authority.</p>
        </div>
      </div>
      <div className="actions">
        <button className="btn ghost" type="button" onClick={onToggleDemo}>
          {demoMode ? "Demo: on" : "Demo: off"}
        </button>
        {connected ? (
          <button className="btn" type="button" onClick={onDisconnect}>
            Disconnect
          </button>
        ) : (
          <button
            className="btn primary"
            type="button"
            onClick={onConnect}
            disabled={!supported || connectionStatus === "connecting"}
          >
            {connectionStatus === "connecting" ? "Connecting…" : "Connect rover"}
          </button>
        )}
        <span className={`pill ${connected ? "ok" : connectionStatus === "error" ? "error" : "neutral"}`}>
          <span className="dot" />
          {STATUS_LABEL[connectionStatus]}
        </span>
      </div>
    </header>
  );
}
