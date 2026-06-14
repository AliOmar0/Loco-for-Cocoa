const EPICURE_MCP_URL =
  process.env.EPICURE_MCP_URL?.trim() ||
  "https://epicure-mcp.kaikaku.ai/mcp";
const MCP_PROTOCOL_VERSION = "2025-03-26";

type McpResponse<T> = {
  jsonrpc: "2.0";
  id?: number | string;
  result?: T;
  error?: { code: number; message: string };
};

type McpToolResult = {
  content?: Array<{ type: string; text?: string }>;
  isError?: boolean;
};

export type EpicurePairings = {
  raw: string;
  clusters: Array<{
    id: string;
    label: string;
    ingredients: Array<{ name: string; score: number }>;
  }>;
  bridges: Array<{
    name: string;
    connects: string[];
    coverage: string;
  }>;
  suggestions: string[];
};

function parseEventStream<T>(value: string): McpResponse<T> {
  const data = value
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);

  for (const row of data) {
    const parsed = JSON.parse(row) as McpResponse<T>;
    if (parsed.result || parsed.error) return parsed;
  }
  throw new Error("Epicure returned an unreadable response.");
}

async function postMcp(
  payload: unknown,
  sessionId?: string,
): Promise<{ response: Response; body: string }> {
  const response = await fetch(EPICURE_MCP_URL, {
    method: "POST",
    signal: AbortSignal.timeout(12_000),
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.text() };
}

function parsePairingGraph(raw: string): EpicurePairings {
  const clusters: EpicurePairings["clusters"] = [];
  const bridges: EpicurePairings["bridges"] = [];
  let section = "";

  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("CLUSTERS")) {
      section = "clusters";
      continue;
    }
    if (line.startsWith("CONNECTIONS")) {
      section = "connections";
      continue;
    }
    if (line.startsWith("BRIDGES")) {
      section = "bridges";
      continue;
    }
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (section === "clusters") {
      const match = trimmed.match(/^([A-Z]) \[([^\]]+)\]: (.+)$/);
      if (!match) continue;
      const ingredients = [...match[3].matchAll(/([^,]+?) \(([\d.]+)\)(?:,|$)/g)]
        .map((item) => ({
          name: item[1].trim(),
          score: Number(item[2]),
        }))
        .filter((item) => item.name && Number.isFinite(item.score));
      clusters.push({ id: match[1], label: match[2], ingredients });
    }

    if (section === "bridges") {
      const match = trimmed.match(/^(.+?) -> (.+?) \(([^)]+)\)$/);
      if (!match) continue;
      bridges.push({
        name: match[1].trim(),
        connects: match[2].split(",").map((item) => item.trim()),
        coverage: match[3].trim(),
      });
    }
  }

  const suggestions = [
    ...bridges.map((bridge) => bridge.name),
    ...clusters.flatMap((cluster) =>
      cluster.ingredients.map((ingredient) => ingredient.name),
    ),
  ].filter(
    (name, index, items) =>
      items.findIndex((item) => item.toLowerCase() === name.toLowerCase()) ===
      index,
  );

  return { raw, clusters, bridges, suggestions };
}

export async function findEpicurePairings(
  ingredients: string[],
  options: { vegan?: boolean; vegetarian?: boolean } = {},
): Promise<EpicurePairings> {
  const initialized = await postMcp({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "loco-for-cocoa", version: "2.0.0" },
    },
  });
  if (!initialized.response.ok) {
    throw new Error("Epicure pairing service is unavailable.");
  }
  const sessionId = initialized.response.headers.get("mcp-session-id");
  if (!sessionId) throw new Error("Epicure did not create an MCP session.");

  // Epicure currently runs on multiple replicas without sticky sessions.
  // Retrying the stateless call lets it reach the replica that owns the session.
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await postMcp(
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      },
      sessionId,
    );
    const called = await postMcp(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "find_pairings",
          arguments: {
            ingredients,
            is_vegan: Boolean(options.vegan),
            is_vegetarian: Boolean(options.vegetarian || options.vegan),
          },
        },
      },
      sessionId,
    );
    if (called.response.status === 404 && called.body.includes("Session not found")) {
      continue;
    }
    if (!called.response.ok) {
      throw new Error("Epicure could not calculate those pairings.");
    }
    const payload = parseEventStream<McpToolResult>(called.body);
    if (payload.error) throw new Error(payload.error.message);
    const text = payload.result?.content?.find(
      (item) => item.type === "text" && item.text,
    )?.text;
    if (!text || payload.result?.isError) {
      throw new Error("Epicure returned no pairing graph.");
    }
    return parsePairingGraph(text);
  }

  throw new Error("Epicure's pairing service could not keep a session.");
}
