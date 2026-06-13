import { serviceStatus } from "../server/config.js";
import {
  json,
  methodNotAllowed,
  preflight,
} from "../server/cors.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);
    const services = serviceStatus();
    return json(request, {
      ok: Object.values(services).every(Boolean),
      services,
    });
  },
};
