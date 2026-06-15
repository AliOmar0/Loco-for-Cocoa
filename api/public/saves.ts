import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";
import { getOwnerEmail } from "../../server/config.js";
import { loadArchive, setRecipeSave } from "../../server/database.js";
import { recipeSaveSchema } from "../../server/validation.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      const parsed = recipeSaveSchema.safeParse(await request.json());
      if (!parsed.success) {
        return json(request, { error: "The recipe save is invalid." }, 400);
      }
      const archive = await loadArchive(getOwnerEmail());
      const recipeExists = archive.recipes.some(
        (recipe) => recipe.id === parsed.data.recipeId && recipe.published,
      );
      if (!recipeExists) return json(request, { error: "Recipe not found." }, 404);
      const saves = await setRecipeSave(
        parsed.data.recipeId,
        parsed.data.visitorId,
        parsed.data.saved,
      );
      return json(request, { ok: true, saved: parsed.data.saved, saves });
    } catch (error) {
      return publicError(request, error);
    }
  },
};
