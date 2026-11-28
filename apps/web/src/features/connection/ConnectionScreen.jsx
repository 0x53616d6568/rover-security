import { useState } from "react";
import { Battery, PlugZap, Radio, ShieldCheck, Signal, Wifi } from "lucide-react";

import { readNumber, readText } from "../../shared/lib/readings";
import { formatAge } from "../../protocol/telemetry";
import { Button, Field, Input, PageHeader, Panel, PanelHeader, StatusPill } from "../../shared/ui";

function linkState(active, connecting, errored) {
  if (active) return { tone: "live", text: "Connected", dot: true };
  if (connecting) return { tone: "warn", text: "Connecting", dot: true };
  if (errored) return { tone: "danger", text: "Error", dot: true };
  return { tone: "neutral", text: "Offline", dot: true };
}

export default function ConnectionScreen({
  state,
  connected,
  connect,
  disconnect,
  toggleDemo,
  arm,
  disarm,
  sendWifi,
  selectedRoverId,
}) {
  const [wifiSsid, setWifiSsid] = useState("");
  const [wifiPassword, setWifiPassword] = useState("");
  const [wifiBusy, setWifiBusy] = useState(false);
  const [wifiError, setWifiError] = useState("");

  const ready = connected && Boolean(selectedRoverId);
  const connecting = state.connectionStatus === "connecting";
  const errored = state.connectionStatus === "error";
  const telemetryLink = linkState(state.links.telemetry, connecting, errored);
  const commandLink = linkState(state.links.command, connecting, errored);
  const raw = state.telemetry?.raw ?? {};
  const battery = readNumber(raw, "BATTERY");
  const telemetryAge = state.telemetry ? formatAge(state.telemetry.ageMs, state.telemetry.receivedAt) : "—";
  const armed = state.safetyState === "MANUAL";

  const sendWifiCredentials = async () => {
    if (!wifiSsid.trim() || !wifiPassword) {
      setWifiError("Enter both the WiFi SSID and password.");
      return;
    }
    setWifiBusy(true);
    setWifiError("");
    try {
      await sendWifi(wifiSsid, wifiPassword);
    } catch (error) {
      setWifiError(error instanceof Error ? error.message : "WiFi init failed.");
    } finally {
      setWifiBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transport & authority"
        title="Link"
        description="Two independent MQTT links plus the alternate BLE path. Commands need the command link; telemetry loss never grants motion."
        meta={
          <>
            <StatusPill
              tone={connected ? "live" : connecting ? "warn" : errored ? "danger" : "neutral"}
              label={connected ? "Rover connected" : state.connectionStatus}
              pulse={connecting}
            />
            <StatusPill tone={commandLink.tone} label={`CMD ${commandLink.text}`} />
            <StatusPill tone={telemetryLink.tone} label={`TLM ${telemetryLink.text}`} />
            <StatusPill
              tone={armed ? "live" : state.safetyState === "FAULT" ? "danger" : "neutral"}
              label={state.safetyState}
              dot={false}
            />
          </>
        }
        actions={
          <>
            <Button variant={state.demoMode ? "secondary" : "ghost"} size="sm" onClick={toggleDemo}>
              {state.demoMode ? "Demo on" : "Demo off"}
            </Button>
            <Button
              variant={connected ? "secondary" : "primary"}
              size="sm"
              onClick={() => (connected ? disconnect() : connect())}
              disabled={connecting}
            >
              <PlugZap size={13} />
              {connecting ? "Connecting…" : connected ? "Disconnect" : "Connect"}
            </Button>
            <Button
              variant={armed ? "stop" : "live"}
              size="sm"
              onClick={() => (armed ? disarm() : arm())}
              disabled={!ready || state.armPending}
            >
              <ShieldCheck size={13} />
              {armed ? "Disarm" : "Arm"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Panel className="p-4">
          <div className="micro-label">Overall link</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-live" : connecting ? "bg-accent" : "bg-danger"}`} />
            <span className="text-sm font-medium text-ink">{state.connectionStatus}</span>
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="micro-label">Telemetry MQTT</div>
          <div className="mt-2">
            <StatusPill tone={telemetryLink.tone} label={telemetryLink.text} />
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="micro-label">Command MQTT</div>
          <div className="mt-2">
            <StatusPill tone={commandLink.tone} label={commandLink.text} />
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="micro-label">Authorization</div>
          <div className="mt-2">
            <StatusPill tone={state.authorized ? "live" : "neutral"} label={state.authorized ? "Granted" : "None"} dot={false} />
          </div>
        </Panel>
        <Panel className="p-4">
          <div className="micro-label">Safety state</div>
          <div className="mt-2">
            <StatusPill
              tone={armed ? "live" : state.safetyState === "FAULT" ? "danger" : "neutral"}
              label={state.safetyState}
              dot={false}
            />
          </div>
        </Panel>
      </div>

      <div className="rounded-md border border-accent/25 bg-accent-soft px-4 py-3 text-xs leading-relaxed text-accent">
        Motion requires the command MQTT link and an explicit arm. Telemetry is read-only: losing it does not
        stop the rover, but stop driving if you cannot see its state. Commands are bounded, time out after
        500 ms, and never auto-resume.
      </div>

      {!state.supported && state.supportMessage && (
        <p className="rounded-md border border-danger-line bg-danger-soft px-4 py-3 text-xs text-danger">
          {state.supportMessage}
        </p>
      )}

      <Panel>
        <div className="p-4">
          <PanelHeader
            eyebrow="BLE provisioning"
            title="WiFi link initialization"
            description="Sends a bounded BLE frame with the credentials the rover stores and rejoins with. The rover drops motion authority until it is re-armed."
            actions={<StatusPill tone={ready ? "live" : "neutral"} label={ready ? "Rover ready" : "Rover required"} />}
          />
        </div>
        <div className="grid gap-3 border-t border-line p-4 sm:grid-cols-2">
          <Field label="Network SSID" htmlFor="wifi-ssid">
            <Input
              id="wifi-ssid"
              value={wifiSsid}
              onChange={(event) => setWifiSsid(event.target.value)}
              placeholder="Network SSID"
              autoComplete="off"
              disabled={!ready || wifiBusy}
            />
          </Field>
          <Field label="Network password" htmlFor="wifi-password" hint="Sent over the command characteristic; never stored in this app.">
            <Input
              id="wifi-password"
              type="password"
              value={wifiPassword}
              onChange={(event) => setWifiPassword(event.target.value)}
              placeholder="Network password"
              autoComplete="off"
              disabled={!ready || wifiBusy}
            />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line p-4">
          <Button
            variant="secondary"
            onClick={() => void sendWifiCredentials()}
            disabled={wifiBusy || !ready || !wifiSsid.trim() || !wifiPassword}
          >
            <Wifi size={13} />
            {wifiBusy ? "Sending…" : "Send WiFi init"}
          </Button>
          {!ready && <span className="text-[11px] text-ink-faint">Connect and select a rover first.</span>}
          {wifiError && <span role="alert" className="text-xs text-danger">{wifiError}</span>}
        </div>
      </Panel>

      {state.connectionError && (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-4 py-3 text-xs leading-relaxed text-danger">
          {state.connectionError}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="p-4">
            <PanelHeader eyebrow="Protocol" title="BLE contract" description="Status notifications are authoritative; commands are bounded ASCII frames." />
          </div>
          <div className="space-y-2 border-t border-line p-4">
            <div className="flex items-center justify-between rounded-sm bg-bg-elevated px-3 py-2 font-mono text-[11px]">
              <span className="text-ink-faint">Service</span>
              <span className="text-ink">8f4d0001</span>
            </div>
            <div className="flex items-center justify-between rounded-sm bg-bg-elevated px-3 py-2 font-mono text-[11px]">
              <span className="text-ink-faint">Command</span>
              <span className="text-ink">8f4d0002</span>
            </div>
            <div className="flex items-center justify-between rounded-sm bg-bg-elevated px-3 py-2 font-mono text-[11px]">
              <span className="text-ink-faint">Status</span>
              <span className="text-ink">8f4d0003</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-ink-muted">
              <Signal size={13} className="text-accent" />
              <span>RSSI {readText(raw, "RSSI", "N/A")}</span>
              <Radio size={13} className="text-accent" />
              <span>BLE</span>
              <Battery size={13} className="text-accent" />
              <span>{battery === null ? "—" : `${Math.round(battery)}%`}</span>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <PanelHeader eyebrow="Device" title="Rover identity" description="Values come from the selected binding and the last status frame." />
          </div>
          <dl className="divide-y divide-line border-t border-line text-xs">
            {[
              ["Model", "TerraRover X1"],
              ["Selected rover", selectedRoverId ?? "None"],
              ["Firmware", readText(raw, "FW", "unknown")],
              ["Last ACK", state.lastAck ? `${state.lastAck.event} #${state.lastAck.sequence}` : "—"],
              ["Telemetry age", telemetryAge],
              ["Sensor validity", state.telemetry?.sensorData ?? "unavailable"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <dt className="text-ink-faint">{label}</dt>
                <dd className="data-value truncate text-ink-muted">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
