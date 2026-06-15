import { requireOwner } from "../../server/auth.js";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";
import {
  findEpicurePairings,
  type EpicurePairings,
} from "../../server/epicure.js";
import {
  generateRecipePackage,
  RecipeAiError,
  recipeGenerationRequestSchema,
} from "../../server/recipe-ai.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      await requireOwner(request);
      const parsed = recipeGenerationRequestSchema.parse(await request.json());
      let pairingWarning = "";
      let pairings: EpicurePairings;
      try {
        pairings = await findEpicurePairings(parsed.ingredients, {
          vegetarian: parsed.vegetarian,
          vegan: parsed.plantBased,
        });
      } catch {
        pairingWarning =
          "Epicure's live pairing graph was temporarily unavailable, so the recipe used your selected ingredients directly.";
        pairings = {
          raw: "No live pairing graph was available. Develop the recipe from the selected ingredients and constraints.",
          clusters: [],
          bridges: [],
          suggestions: [],
        };
      }
      const generated = await generateRecipePackage(parsed, pairings);
      if (pairingWarning) generated.warnings.unshift(pairingWarning);
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
      if (error instanceof RecipeAiError) {
        return json(
          request,
          { error: error.message, code: error.code },
          error.status,
        );
      }
      return publicError(request, error);
    }
  },
};
