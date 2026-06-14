import { requireOwner } from "../../server/auth.js";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";
import { findEpicurePairings } from "../../server/epicure.js";
import {
  generateRecipePackage,
  recipeGenerationRequestSchema,
} from "../../server/recipe-ai.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      await requireOwner(request);
      const parsed = recipeGenerationRequestSchema.parse(await request.json());
      const pairings = await findEpicurePairings(parsed.ingredients, {
        vegetarian: parsed.vegetarian,
        vegan: parsed.plantBased,
      });
      const generated = await generateRecipePackage(parsed, pairings);
      return json(request, generated);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
      }
      if (error instanceof Error && error.message === "DEEPSEEK_NOT_CONFIGURED") {
        return json(
          request,
          {
            error:
              "Recipe generation needs DEEPSEEK_API_KEY in the Vercel project.",
          },
          503,
        );
      }
      return publicError(request, error);
    }
  },
};

