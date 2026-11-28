import { Camera, HardDrive, MonitorPlay, VideoOff } from "lucide-react";

import { readText } from "../../shared/lib/readings";
import { PageHeader, Panel, PanelHeader, StatusPill } from "../../shared/ui";

export default function CameraScreen({ state }) {
  const raw = state.telemetry?.raw ?? {};
  const cameraState = readText(raw, "CAMERA", "not configured");
  const ready = ["ready", "streaming", "live", "available"].includes(cameraState.toLowerCase());

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Auxiliary payload"
        title="Camera"
        description="The ESP32-CAM is an auxiliary payload with no motor authority. Phase 1 defines no camera-control characteristic, so this console does not invent one."
        meta={
          <>
            <StatusPill tone={ready ? "live" : "neutral"} label={cameraState} dot={false} />
            <StatusPill tone="neutral" label={`Storage ${readText(raw, "STORAGE", "unavailable")}`} dot={false} />
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.5fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Camera size={14} className="text-accent" />
              <span className="text-xs font-medium text-ink">ESP32-CAM feed</span>
            </div>
            <StatusPill tone="neutral" label="No feed" />
          </div>

          <div className="relative aspect-video w-full overflow-hidden bg-[#050807]">
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <VideoOff size={22} className="text-ink-faint" />
              <p className="max-w-sm text-sm leading-relaxed text-ink-faint">
                Camera feed is not part of the Phase 1 BLE control link.
              </p>
            </div>

            <div className="pointer-events-none absolute left-3 top-3 space-y-1 font-mono text-[10px] text-ink-muted">
              <div className="rounded-sm bg-black/65 px-2 py-1">Speed {readText(raw, "SPEED", "—")} m/s</div>
              <div className="rounded-sm bg-black/65 px-2 py-1">Heading {readText(raw, "HEADING", "—")}°</div>
              <div className="rounded-sm bg-black/65 px-2 py-1">Pitch {readText(raw, "PITCH", "—")}°</div>
              <div className="rounded-sm bg-black/65 px-2 py-1">Roll {readText(raw, "ROLL", "—")}°</div>
            </div>

            <div className="absolute bottom-3 right-3 rounded-sm bg-black/65 px-2 py-1 font-mono text-[10px] text-ink-faint">
              {state.telemetry ? new Date(state.telemetry.receivedAt).toLocaleTimeString() : "no frame"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-line p-4 sm:grid-cols-4">
            {[
              ["Camera", cameraState],
              ["Storage", readText(raw, "STORAGE", "unavailable")],
              ["Resolution", readText(raw, "CAM_RES", "N/A")],
              ["Last capture", readText(raw, "LAST_CAPTURE", "—")],
            ].map(([label, value]) => (
              <div key={label} className="reading">
                <span className="label">{label}</span>
                <span className="value text-sm">{value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel className="p-4">
            <PanelHeader
              eyebrow="Contract"
              title="Camera controls"
              description="Unsupported until a documented characteristic exists."
              actions={<StatusPill tone="warn" label="Not wired" dot={false} />}
            />
            <ul className="mt-4 space-y-2">
              {[
                ["Select camera", MonitorPlay],
                ["Resolution", Camera],
                ["Orientation", MonitorPlay],
                ["Capture", HardDrive],
              ].map(([label, Icon]) => (
                <li
                  key={label}
                  className="flex items-center justify-between rounded-sm border border-line bg-bg-elevated px-3 py-2 text-xs text-ink-faint"
                >
                  <span className="flex items-center gap-2">
                    <Icon size={13} />
                    {label}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em]">unsupported</span>
                </li>
              ))}
            </ul>
          </Panel>

          <div className="rounded-md border border-accent/25 bg-accent-soft px-4 py-3 text-[11px] leading-relaxed text-accent">
            Do not enable capture controls from the UI alone. Add the characteristic to the firmware contract,
            validate it on hardware, then wire it here.
          </div>
        </div>
      </div>
    </div>
  );
}
