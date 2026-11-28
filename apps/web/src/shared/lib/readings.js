// Telemetry arrives as strings. These helpers keep "missing" distinct from a
// real zero so the UI never invents a sensor value.

export function readNumber(raw, key) {
  const value = raw?.[key];
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function readText(raw, key, fallback = "—") {
  const value = raw?.[key];
  if (value === undefined || value === null || String(value).trim() === "") return fallback;
  return String(value);
}

export function readValidity(raw, key, fallback = "unavailable") {
  return readText(raw, key, fallback);
}

/** Map a telemetry validity token to a status-pill tone. */
export function validityTone(validity) {
  const token = String(validity ?? "unavailable").toLowerCase();
  if (token === "available") return "live";
  if (token === "invalid") return "danger";
  if (token === "stale" || token === "simulated") return "warn";
  return "neutral";
}
