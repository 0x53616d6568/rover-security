import { Keyboard, RadioTower, ShieldAlert, Siren } from "lucide-react";

import { PageHeader, Panel, PanelHeader } from "../../shared/ui";

const shortcuts = [
  { keys: ["Z", "↑"], action: "Move forward" },
  { keys: ["S", "↓"], action: "Move reverse" },
  { keys: ["Q", "←"], action: "Turn left" },
  { keys: ["D", "→"], action: "Turn right" },
  { keys: ["Space"], action: "Emergency stop" },
  { keys: ["Release"], action: "Return to neutral" },
];

const safety = [
  "Arm the rover before driving; arming is never automatic.",
  "Releasing all keys returns the axes to neutral.",
  "A lost BLE link, page hide, or fault triggers the firmware safe stop.",
  "The physical emergency stop is independent of this app and must stay reachable.",
  "Do not expose the command broker or this console to the public internet.",
];

export default function HelpScreen() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reference"
        title="Help"
        description="Keyboard control, safety rules, and the link semantics the console enforces."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <div className="p-4">
            <PanelHeader
              eyebrow="Desktop"
              title="Keyboard shortcuts"
              description="AZERTY gaming layout. Shortcuts are ignored while typing in a field and only act when the rover is armed."
              actions={<Keyboard size={16} className="text-accent" />}
            />
          </div>
          <div className="grid gap-2 border-t border-line p-4 sm:grid-cols-2">
            {shortcuts.map(({ keys, action }) => (
              <div
                key={keys.join("+")}
                className="flex items-center justify-between gap-3 rounded-sm border border-line bg-bg-elevated px-3 py-2"
              >
                <span className="flex gap-1">
                  {keys.map((key) => (
                    <kbd
                      key={key}
                      className="min-w-6 rounded-xs border border-line-strong bg-surface-2 px-1.5 py-0.5 text-center font-mono text-[10px] text-ink"
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
                <span className="text-right text-xs text-ink-muted">{action}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <div className="p-4">
            <PanelHeader
              eyebrow="Safety"
              title="Rules of operation"
              description="The console is a control surface, not a second safety controller."
              actions={<ShieldAlert size={16} className="text-accent" />}
            />
          </div>
          <ul className="space-y-3 border-t border-line p-4">
            {safety.map((rule) => (
              <li key={rule} className="flex gap-2.5 text-xs leading-relaxed text-ink-muted">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                {rule}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <PanelHeader
            eyebrow="Transport"
            title="Two links, two jobs"
            description="Telemetry is read-only. Driving publishes bounded commands on a separate broker."
            actions={<RadioTower size={16} className="text-accent" />}
          />
          <dl className="mt-4 space-y-2 text-xs">
            {[
              ["Telemetry MQTT", "Subscribe-only status frames. Losing it never grants motion."],
              ["Command MQTT", "Publish-only bounded frames with a 500 ms timeout and explicit arm/STOP."],
              ["BLE (alternate)", "Local bring-up path using the documented GATT service and characteristics."],
              ["Sequence numbers", "Allocated synchronously; the firmware rejects duplicate or regressing sequences."],
            ].map(([term, detail]) => (
              <div key={term} className="rounded-sm border border-line bg-bg-elevated px-3 py-2">
                <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-accent">{term}</dt>
                <dd className="mt-1 leading-relaxed text-ink-muted">{detail}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Panel className="p-4">
          <PanelHeader
            eyebrow="Recovery"
            title="If something looks wrong"
            description="Stop first, diagnose second."
            actions={<Siren size={16} className="text-danger" />}
          />
          <ol className="mt-4 space-y-3 text-xs leading-relaxed text-ink-muted">
            <li>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-danger">01</span>{" "}
              Press STOP, then use the physical cut-off if motion continues.
            </li>
            <li>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-danger">02</span>{" "}
              Check the safety state and command link before re-arming. There is no auto-resume.
            </li>
            <li>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-danger">03</span>{" "}
              If telemetry is stale, treat every reading as unknown until a fresh frame arrives.
            </li>
            <li>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-danger">04</span>{" "}
              Record the event log and the exact sequence before repeating the test.
            </li>
          </ol>
        </Panel>
      </div>
    </div>
  );
}
