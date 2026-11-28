export default function Compass({ heading = null }) {
  const hasHeading = heading !== null && heading !== undefined && String(heading).trim() !== "";
  const parsed = hasHeading ? Number(heading) : Number.NaN;
  const available = Number.isFinite(parsed);
  const deg = available ? ((parsed % 360) + 360) % 360 : 0;

  return (
    <div
      className="relative mx-auto h-32 w-32 shrink-0 rounded-full border border-line-strong bg-bg-elevated"
      role="img"
      aria-label={available ? `Heading ${deg.toFixed(0)} degrees` : "Heading unavailable"}
    >
      <div className="absolute inset-2 rounded-full border border-line" aria-hidden="true" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="data-value text-sm text-ink">{available ? `${deg.toFixed(0)}°` : "N/A"}</div>
      </div>
      {available && (
        <div
          className="absolute left-1/2 top-1/2 h-11 w-0.5 -translate-x-1/2 origin-bottom rounded-pill bg-accent"
          style={{ transform: `translate(-50%, -100%) rotate(${deg}deg)` }}
          aria-hidden="true"
        />
      )}
      <div className="absolute left-1/2 top-1 -translate-x-1/2 font-mono text-[10px] text-accent">N</div>
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 font-mono text-[10px] text-ink-faint">S</div>
      <div className="absolute left-1 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-faint">W</div>
      <div className="absolute right-1 top-1/2 -translate-y-1/2 font-mono text-[10px] text-ink-faint">E</div>
    </div>
  );
}
