/**
 * Vercel serverless proxy for /api/*.
 *
 * The browser calls same-origin /api/... paths. This function forwards them to
 * the Render API, including the session cookie, so no CORS or SameSite=None is
 * needed. Set ROVER_API_ORIGIN in the Vercel project settings.
 */
export const config = { runtime: "nodejs" };

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "content-length",
  "content-encoding",
]);

export default async function handler(req, res) {
  const origin = process.env.ROVER_API_ORIGIN;
  if (!origin) {
    return res.status(500).json({
      ok: false,
      error: "ROVER_API_ORIGIN is not configured on the Vercel project.",
      code: "proxy_misconfigured",
    });
  }

  const segments = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : req.query.path ?? "";
  const queryIndex = req.url?.indexOf("?") ?? -1;
  const query = queryIndex >= 0 ? req.url.slice(queryIndex) : "";
  const target = `${origin.replace(/\/+$/, "")}/api/${segments}${query}`;

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key) || key === "host" || value === undefined) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : value;
  }

  const init = { method: req.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(req.method)) {
    if (typeof req.body === "string" || Buffer.isBuffer(req.body)) {
      init.body = req.body;
    } else if (req.body && Object.keys(req.body).length > 0) {
      init.body = JSON.stringify(req.body);
    } else {
      init.body = "";
    }
  }

  let upstream;
  try {
    upstream = await fetch(target, init);
  } catch (error) {
    return res.status(502).json({
      ok: false,
      error: "Rover API is unavailable.",
      code: "upstream_unreachable",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  res.status(upstream.status);
  upstream.headers.forEach((value, key) => {
    if (HOP_BY_HOP.has(key) || key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });

  // Express may set more than one cookie; preserve all of them.
  const cookies = upstream.headers.getSetCookie?.() ?? [];
  if (cookies.length > 0) res.setHeader("set-cookie", cookies);

  return res.send(Buffer.from(await upstream.arrayBuffer()));
}
