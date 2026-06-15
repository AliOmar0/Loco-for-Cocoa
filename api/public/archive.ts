import { getOwnerEmail } from "../../server/config.js";
import {
  loadArchive,
  loadRecipeSaves,
  loadRecipeViews,
} from "../../server/database.js";
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
      const archive = await loadArchive(getOwnerEmail());
      if (!archive.initialized) return json(request, archive);

      const [viewCounts, saveCounts] = await Promise.all([
        loadRecipeViews(),
        loadRecipeSaves(),
      ]);
      const recipes = archive.recipes
        .filter((recipe) => recipe.published)
        .map((recipe) => ({
          ...recipe,
          views: viewCounts.get(recipe.id) || 0,
          saves: saveCounts.get(recipe.id) || 0,
        }));
      const publishedIds = new Set(recipes.map((recipe) => recipe.id));
      const collections = archive.collections
        .filter((collection) => collection.enabled)
        .map((collection) => ({
          ...collection,
          recipeIds: collection.recipeIds.filter((id) => publishedIds.has(id)),
        }))
        .filter((collection) => collection.recipeIds.length > 0);
      const response = json(request, { ...archive, recipes, collections });
      response.headers.set(
        "Cache-Control",
        "public, s-maxage=60, stale-while-revalidate=300",
      );
      return response;
    } catch (error) {
      return publicError(request, error);
    }
  },
};
