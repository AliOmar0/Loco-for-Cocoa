const DEFAULT_ORIGINS = [
  "https://aliomar0.github.io",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
];

function allowedOrigins() {
  const configured = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const deploymentOrigin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "";

  return new Set([
    ...DEFAULT_ORIGINS,
    ...configured,
    ...(deploymentOrigin ? [deploymentOrigin] : []),
  ]);
}

export function corsHeaders(request: Request) {
  const headers = new Headers({
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin && allowedOrigins().has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

export function preflight(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !allowedOrigins().has(origin)) {
    return json(request, { error: "Origin is not allowed." }, 403);
  }
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function json(request: Request, data: unknown, status = 200) {
  const headers = corsHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers });
}

export function methodNotAllowed(request: Request, methods: string[]) {
  const response = json(request, { error: "Method not allowed." }, 405);
  response.headers.set("Allow", [...methods, "OPTIONS"].join(", "));
  return response;
}

export function publicError(request: Request, error: unknown) {
  console.error(error);
  const message =
    error instanceof Error &&
    error.message.startsWith("Missing required environment variable:")
      ? "The backend deployment is not fully configured yet."
      : "The server could not complete that request.";
  return json(request, { error: message }, 500);
}
