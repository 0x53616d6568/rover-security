export default function BottomNav() {
  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const items = [
    { id: "control", label: "Control" },
    { id: "telemetry", label: "Telemetry" },
    { id: "settings", label: "Settings" },
  ];
  return (
    <nav
      style={{
        position: "sticky",
        bottom: 0,
        zIndex: 20,
        marginTop: 16,
        display: "flex",
        justifyContent: "space-around",
        padding: 8,
        borderRadius: 16,
        border: "1px solid var(--line)",
        background: "rgba(37,56,44,0.75)",
        backdropFilter: "blur(10px)",
      }}
    >
      {items.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => go(id)}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--ink-card)",
            padding: "6px 12px",
            borderRadius: 10,
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
