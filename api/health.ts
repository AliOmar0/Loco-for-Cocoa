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
      providers: {
        recipeAi: Boolean(process.env.DEEPSEEK_API_KEY),
        nutrition: Boolean(process.env.USDA_API_KEY),
        imageAi: Boolean(process.env.GEMINI_API_KEY),
      },
    });
  },
};
