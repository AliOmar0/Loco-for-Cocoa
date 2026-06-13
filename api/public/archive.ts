import { getOwnerEmail } from "../../server/config";
import { loadArchive } from "../../server/database";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "GET") return methodNotAllowed(request, ["GET"]);

    try {
      const archive = await loadArchive(getOwnerEmail());
      if (!archive.initialized) return json(request, archive);

      const recipes = archive.recipes.filter((recipe) => recipe.published);
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
