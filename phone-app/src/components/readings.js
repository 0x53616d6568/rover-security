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
