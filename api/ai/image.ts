import { requireOwner } from "../../server/auth.js";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors.js";
import {
  generateRecipeThumbnail,
  RecipeAiError,
  recipeThumbnailRequestSchema,
} from "../../server/recipe-ai.js";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      await requireOwner(request);
      const parsed = recipeThumbnailRequestSchema.parse(await request.json());
      const image = await generateRecipeThumbnail(parsed);
      return json(request, { image: image.url, provider: image.provider });
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
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
