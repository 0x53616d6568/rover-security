export default function TerrainMap({ label = "Tunis" }) {
  return (
    <div className="relative h-24 w-full overflow-hidden rounded-2xl bg-white/5 border border-white/10">
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
      <div className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-400 shadow-[0_0_12px_#4ade80]" />
      <div className="absolute bottom-2 right-2 text-[10px] text-text-secondary">{label}</div>
    </div>
  );
}
