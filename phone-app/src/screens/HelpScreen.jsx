const panel = "rounded-2xl border border-white/10 bg-white/[0.04] p-4";

const shortcuts = [
  { keys: "Z / ↑", action: "Move forward" },
  { keys: "S / ↓", action: "Move reverse" },
  { keys: "Q / ←", action: "Turn left" },
  { keys: "D / →", action: "Turn right" },
  { keys: "Space", action: "Emergency stop" },
  { keys: "Release", action: "Return to neutral" },
];

export default function HelpScreen() {
  return (
    <div className="space-y-4">
      <div className={`${panel} text-text-primary`}>
        <h2 className="text-sm font-semibold">Keyboard shortcuts (desktop)</h2>
        <p className="mt-1 text-xs text-white/60">AZERTY gaming layout. Controls only work while the rover is armed.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {shortcuts.map((s) => (
            <div key={s.keys} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-xs">
              <span className="font-mono text-green-400">{s.keys}</span>
              <span className="text-white/70">{s.action}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={`${panel} text-text-primary`}>
        <h2 className="text-sm font-semibold">Safety</h2>
        <ul className="mt-2 space-y-1 text-xs text-white/60">
          <li>Arm the rover before driving.</li>
          <li>Releasing all keys returns to neutral.</li>
          <li>BLE disconnect triggers firmware safe stop.</li>
          <li>Physical emergency stop is independent.</li>
        </ul>
      </div>
    </div>
  );
}