import { requireOwner } from "../../server/auth.js";
import { loadArchive, loadRecipeSaves } from "../../server/database.js";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);

    try {
      const owner = await requireOwner(request);
      const archive = await loadArchive(owner.email);
      if (!archive.initialized) return json(request, archive);
      const saveCounts = await loadRecipeSaves();
      return json(request, {
        ...archive,
        recipes: archive.recipes.map((recipe) => ({
          ...recipe,
          saves: saveCounts.get(recipe.id) || 0,
        })),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
      }
      return publicError(request, error);
    }
  },
};
