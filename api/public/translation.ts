import { getOwnerEmail } from "../../server/config.js";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";
import {
  loadArchive,
  loadRecipeTranslation,
  saveRecipeTranslation,
} from "../../server/database.js";
import {
  RecipeTranslationError,
  translateRecipeToArabic,
} from "../../server/recipe-translation.js";
import { recipeTranslationRequestSchema } from "../../server/validation.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      const parsed = recipeTranslationRequestSchema.safeParse(
        await request.json(),
      );
      if (!parsed.success) {
        return json(request, { error: "The translation request is invalid." }, 400);
      }
      const archive = await loadArchive(getOwnerEmail());
      const recipe = archive.recipes.find(
        (item) => item.id === parsed.data.recipeId && item.published,
      );
      if (!recipe) return json(request, { error: "Recipe not found." }, 404);

      const cached = await loadRecipeTranslation(
        recipe.id,
        parsed.data.language,
        recipe.updatedAt,
      );
      if (cached) return json(request, { translation: cached, cached: true });

      const translation = await translateRecipeToArabic(recipe);
      await saveRecipeTranslation(
        recipe.id,
        parsed.data.language,
        recipe.updatedAt,
        translation,
      );
      return json(request, { translation, cached: false });
    } catch (error) {
      if (error instanceof RecipeTranslationError) {
        return json(request, { error: error.message }, error.status);
      }
      return publicError(request, error);
    }
  },
};
