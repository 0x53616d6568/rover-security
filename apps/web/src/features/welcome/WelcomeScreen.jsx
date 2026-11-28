import { Activity, ArrowRight, Gamepad2, RadioTower, ShieldCheck, Wifi } from "lucide-react";

import { formatAge } from "../../protocol/telemetry";
import { readText } from "../../shared/lib/readings";
import { Button, EmptyState, PageHeader, Panel, PanelHeader, StatusPill } from "../../shared/ui";

function ReadinessRow({ label, value, detail, tone }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-xs font-medium text-ink">{label}</div>
        <div className="mt-0.5 truncate text-[11px] text-ink-faint">{detail}</div>
      </div>
      <StatusPill tone={tone} label={value} dot={false} />
    </div>
  );
}

export default function WelcomeScreen({ state, auth, onNavigate }) {
  const selectedRoverId = state.selectedRoverId;
  const connected = state.connectionStatus === "connected" && Boolean(selectedRoverId);
  const armed = state.safetyState === "MANUAL";
  const ageMs = state.telemetry
    ? (state.telemetry.ageMs ?? Date.now() - state.telemetry.receivedAt)
    : null;
  const telemetryAge = state.telemetry ? formatAge(state.telemetry.ageMs, state.telemetry.receivedAt) : "—";
  const telemetryFresh = ageMs !== null && ageMs < 5000;
  const battery = readText(state.telemetry?.raw ?? {}, "BATTERY", "—");

  const nextStep = !selectedRoverId
    ? {
        title: "Bind or select a rover",
        body: "Open Fleet to add a MAC binding or select one of your rovers.",
        tab: "fleet",
        action: "Open fleet",
      }
    : !connected
      ? {
          title: "Bring the links up",
          body: "Open Link to connect the command and telemetry channels to the selected rover.",
          tab: "connection",
          action: "Open link",
        }
      : !armed
        ? {
            title: "Arm when the area is clear",
            body: "Arming is explicit. The rover stays disarmed until you command it from Link or Drive.",
            tab: "connection",
            action: "Open link",
          }
        : {
            title: "Drive with the cockpit",
            body: "The rover is armed. Drive from the cockpit; STOP is always available.",
            tab: "control",
            action: "Open drive",
          };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Mission control"
        title={`Welcome, ${auth?.name ?? "operator"}`}
        description="One console for the rover link, the safety state, and the telemetry frame. Every value below is sourced from the rover or the signed-in session."
        meta={
          <>
            <StatusPill tone={connected ? "live" : "neutral"} label={connected ? "Rover connected" : "Rover offline"} pulse={connected} />
            <StatusPill tone={state.links.command ? "live" : "danger"} label={state.links.command ? "CMD online" : "CMD offline"} />
            <StatusPill tone={armed ? "live" : state.safetyState === "FAULT" ? "danger" : "neutral"} label={state.safetyState} dot={false} />
          </>
        }
        actions={
          <Button variant="primary" onClick={() => onNavigate("connection")}>
            Open link
            <ArrowRight size={14} />
          </Button>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Panel className="relative overflow-hidden p-6 sm:p-8">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(620px 320px at 82% 8%, rgba(233,180,76,0.12), transparent 62%), radial-gradient(480px 280px at 8% 108%, rgba(95,211,160,0.07), transparent 60%)",
            }}
            aria-hidden="true"
          />
          <div className="relative">
            <div className="micro-label flex items-center gap-2">
              <span className="inline-block h-px w-5 bg-accent/70" />
              ROVERX · Phase 1
            </div>
            <h2 className="mt-4 max-w-xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-4xl">
              Drive with a clear picture of the link, the state, and the stop.
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-ink-muted">
              The console separates telemetry from commands, keeps arm and STOP explicit, and marks missing
              sensor data instead of inventing it. The rover firmware still owns authorization, timeouts, and
              motor cut-off.
            </p>

            <div className="mt-7 flex flex-wrap gap-2">
              <Button variant="primary" onClick={() => onNavigate(selectedRoverId ? "connection" : "fleet")}>
                {selectedRoverId ? "Connect rover" : "Select a rover"}
                <ArrowRight size={14} />
              </Button>
              <Button variant="secondary" onClick={() => onNavigate("control")} disabled={!connected}>
                <Gamepad2 size={14} />
                Open drive
              </Button>
              <Button variant="ghost" onClick={() => onNavigate("telemetry")}>
                <Activity size={14} />
                Telemetry
              </Button>
            </div>

            <div className="mt-8 flex items-end justify-between gap-4 border-t border-line pt-5">
              <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
                <span>Owner {auth?.name ?? "—"}</span>
                <span>Rover {selectedRoverId ?? "none"}</span>
                <span>Battery {battery}</span>
              </div>
              <img src="/rover.svg" alt="" aria-hidden="true" className="hidden h-16 w-auto opacity-80 sm:block" />
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <PanelHeader eyebrow="Readiness" title="Pre-drive checks" description="All five gates must line up before motion." />
          <div className="mt-3">
            <ReadinessRow
              label="Owner session"
              value={auth ? "Signed in" : "Locked"}
              detail={auth?.name ?? "No session"}
              tone={auth ? "live" : "danger"}
            />
            <ReadinessRow
              label="Rover selected"
              value={selectedRoverId ? "Selected" : "None"}
              detail={selectedRoverId ?? "Bind a rover in Fleet"}
              tone={selectedRoverId ? "live" : "neutral"}
            />
            <ReadinessRow
              label="Command MQTT"
              value={state.links.command ? "Online" : "Offline"}
              detail={state.links.command ? "Motion channel ready" : "Motion commands blocked"}
              tone={state.links.command ? "live" : "danger"}
            />
            <ReadinessRow
              label="Telemetry"
              value={state.telemetry ? telemetryAge : "No frame"}
              detail={telemetryFresh ? "Frame is fresh" : "Frame is missing or stale"}
              tone={telemetryFresh ? "live" : state.telemetry ? "warn" : "neutral"}
            />
            <ReadinessRow
              label="Safety state"
              value={state.safetyState}
              detail={armed ? "Manual authority granted" : "Motion inhibited"}
              tone={armed ? "live" : state.safetyState === "FAULT" ? "danger" : "neutral"}
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel className="p-4">
          <div className="flex items-center gap-2 text-ink-faint">
            <ShieldCheck size={14} className="text-accent" />
            <span className="micro-label">Safety state</span>
          </div>
          <div className="mt-3 text-xl font-medium text-ink">{state.safetyState}</div>
          <div className="mt-1 text-[11px] text-ink-faint">{armed ? "Manual authority active" : "No motion authority"}</div>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 text-ink-faint">
            <RadioTower size={14} className="text-accent" />
            <span className="micro-label">Command MQTT</span>
          </div>
          <div className="mt-3 text-xl font-medium text-ink">{state.links.command ? "Online" : "Offline"}</div>
          <div className="mt-1 text-[11px] text-ink-faint">Telemetry {state.links.telemetry ? "online" : "offline"}</div>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 text-ink-faint">
            <Wifi size={14} className="text-accent" />
            <span className="micro-label">Telemetry age</span>
          </div>
          <div className="mt-3 text-xl font-medium text-ink">{telemetryAge}</div>
          <div className="mt-1 text-[11px] text-ink-faint">Sensors {state.telemetry?.sensorData ?? "unavailable"}</div>
        </Panel>
        <Panel className="p-4">
          <div className="flex items-center gap-2 text-ink-faint">
            <Gamepad2 size={14} className="text-accent" />
            <span className="micro-label">Selected rover</span>
          </div>
          <div className="data-value mt-3 truncate text-sm text-ink">{selectedRoverId ?? "None"}</div>
          <div className="mt-1 text-[11px] text-ink-faint">{connected ? "Link active" : "Not connected"}</div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_0.8fr]">
        <Panel>
          <div className="p-4">
            <PanelHeader eyebrow="Next action" title={nextStep.title} description={nextStep.body} />
            <div className="mt-4">
              <Button variant="primary" onClick={() => onNavigate(nextStep.tab)}>
                {nextStep.action}
                <ArrowRight size={14} />
              </Button>
            </div>
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <PanelHeader eyebrow="Event log" title="Latest activity" description="Newest first, heartbeat suppressed." />
          </div>
          {state.events.length === 0 ? (
            <div className="px-4 pb-4">
              <EmptyState title="No events yet" description="Connection, arming, command, and fault events appear here." />
            </div>
          ) : (
            <ul className="event-list border-t border-line">
              {state.events.slice(0, 5).map((event) => (
                <li key={event.id}>
                  <span className="time">{new Date(event.time).toLocaleTimeString()}</span>
                  <span
                    className={`msg ${
                      event.severity === "error" ? "text-danger" : event.severity === "warn" ? "text-accent" : "text-ink-muted"
                    }`}
                  >
                    {event.message}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
