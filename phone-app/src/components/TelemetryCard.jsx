export default function TelemetryCard({ label, value, validity = "unavailable" }) {
  return (
    <div className="rounded-3xl border border-white/20 bg-white/5 p-4 text-text-primary backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">{label}</div>
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-text-secondary">{validity}</span>
      </div>
      <div className="mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}
