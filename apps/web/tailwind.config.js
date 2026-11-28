/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        "bg-elevated": "var(--bg-elevated)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        "surface-3": "var(--surface-3)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        ink: "var(--ink)",
        "ink-muted": "var(--ink-muted)",
        "ink-faint": "var(--ink-faint)",
        accent: "var(--accent)",
        "accent-strong": "var(--accent-strong)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
        live: "var(--live)",
        "live-soft": "var(--live-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        danger: "var(--danger)",
        "danger-soft": "var(--danger-soft)",
        info: "var(--info)",
        "info-soft": "var(--info-soft)",
      },
      fontFamily: {
        sans: ["IBM Plex Sans", "Segoe UI Variable", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Cascadia Mono", "Consolas", "ui-monospace", "monospace"],
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
      },
      boxShadow: {
        panel: "var(--shadow-panel)",
        pop: "var(--shadow-pop)",
      },
      transitionTimingFunction: {
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      screens: {
        xs: "420px",
      },
    },
  },
  plugins: [],
};
