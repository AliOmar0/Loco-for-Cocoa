import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";
import { recordRecipeView } from "../../server/database.js";
import { recipeViewSchema } from "../../server/validation.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      const parsed = recipeViewSchema.safeParse(await request.json());
      if (!parsed.success) {
        return json(request, { error: "The recipe view is invalid." }, 400);
      }
      await recordRecipeView(parsed.data.recipeId, parsed.data.visitorId);
      return json(request, { ok: true });
    } catch (error) {
      return publicError(request, error);
    }
  },
};
