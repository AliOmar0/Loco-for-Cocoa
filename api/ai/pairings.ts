import { requireOwner } from "../../server/auth.js";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";
import { findEpicurePairings } from "../../server/epicure.js";
import { recipeGenerationRequestSchema } from "../../server/recipe-ai.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      await requireOwner(request);
      const parsed = recipeGenerationRequestSchema
        .pick({
          ingredients: true,
          vegetarian: true,
          plantBased: true,
        })
        .parse(await request.json());
      const pairings = await findEpicurePairings(parsed.ingredients, {
        vegetarian: parsed.vegetarian,
        vegan: parsed.plantBased,
      });
      return json(request, pairings);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
      }
      if (error instanceof Error && error.message.startsWith("Epicure")) {
        return json(
          request,
          {
            error:
              "Epicure's live pairing service is temporarily unavailable. You can still generate a recipe from the selected ingredients.",
          },
          503,
        );
      }
      return publicError(request, error);
    }
  },
};
