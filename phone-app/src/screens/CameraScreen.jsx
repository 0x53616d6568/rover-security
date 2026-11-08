import { readText } from "../components/readings";

const glass = "bg-white/5 border border-white/20 backdrop-blur-xl shadow-[0_8px_32px_rgba(8,13,11,0.25)]";

export default function CameraScreen({ state }) {
  const raw = state.telemetry?.raw ?? {};
  return (
    <div className="space-y-4">
      <div className={`${glass} rounded-3xl p-4 text-text-primary`}>
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>ESP32-CAM feed</span>
          <span className="text-white/50">No feed</span>
        </div>
        <div className="relative mt-2 aspect-video w-full overflow-hidden rounded-xl bg-black">
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/30">
            Camera feed is not part of the Phase 1 BLE control link.
          </div>
          <div className="absolute left-3 top-3 space-y-1 text-[10px] text-white/80">
            <div className="rounded bg-black/60 px-2 py-1">
              Speed: {readText(raw, "SPEED", "—")} m/s
            </div>
            <div className="rounded bg-black/60 px-2 py-1">
              Heading: {readText(raw, "HEADING", "—")}°
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-white/70">
          <div>Camera: {readText(raw, "CAMERA", "not configured")}</div>
          <div>Storage: {readText(raw, "STORAGE", "unavailable")}</div>
          <div>Resolution: {readText(raw, "CAM_RES", "N/A")}</div>
          <div>Last capture: {readText(raw, "LAST_CAPTURE", "—")}</div>
        </div>
      </div>

      <div className={`${glass} rounded-3xl p-4 text-text-primary`}>
        <div className="text-sm font-semibold">Camera controls</div>
        <p className="mt-2 text-xs text-white/60">
          No camera-control characteristic is defined in the Phase 1 BLE contract. The app does not
          invent camera commands. Add a documented characteristic before enabling capture controls.
        </p>
        <div className="mt-3 grid gap-2 text-[10px] text-white/60 sm:grid-cols-2">
          <div className="rounded-xl bg-white/5 px-3 py-2">Select camera · unsupported</div>
          <div className="rounded-xl bg-white/5 px-3 py-2">Resolution · unsupported</div>
          <div className="rounded-xl bg-white/5 px-3 py-2">Orientation · unsupported</div>
          <div className="rounded-xl bg-white/5 px-3 py-2">Capture · unsupported</div>
        </div>
      </div>
    </div>
  );
}
