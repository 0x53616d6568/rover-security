export default function Compass({ heading = null }) {
  const hasHeading =
    heading !== null && heading !== undefined && String(heading).trim() !== "";
  const parsed = hasHeading ? Number(heading) : Number.NaN;
  const available = Number.isFinite(parsed);
  const deg = available ? ((parsed % 360) + 360) % 360 : 0;
  return (
    <div className="relative mx-auto h-32 w-32 rounded-full border border-white/10 bg-black/40">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-[10px] text-text-secondary">{available ? `${deg.toFixed(0)}°` : "N/A"}</div>
      </div>
      {available && (
        <div
          className="absolute left-1/2 top-1/2 h-12 w-0.5 -translate-x-1/2 origin-bottom bg-green-400"
          style={{ transform: `translate(-50%, -100%) rotate(${deg}deg)` }}
        />
      )}
      <div className="absolute top-1 left-1/2 -translate-x-1/2 text-[10px] text-text-secondary">N</div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-text-secondary">S</div>
      <div className="absolute left-1 top-1/2 -translate-y-1/2 text-[10px] text-text-secondary">W</div>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] text-text-secondary">E</div>
    </div>
  );
}
