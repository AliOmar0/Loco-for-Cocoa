import { requireOwner } from "../../server/auth.js";
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
      await requireOwner(request);
      const missingRecipe = process.env.DEEPSEEK_API_KEY
        ? []
        : ["DEEPSEEK_API_KEY"];
      const missingNutrition = process.env.USDA_API_KEY
        ? []
        : ["USDA_API_KEY"];
      const missingImage = [
        ...(!process.env.POLLINATIONS_API_KEY &&
        !process.env.GEMINI_API_KEY
          ? ["POLLINATIONS_API_KEY"]
          : []),
        ...(!process.env.BLOB_READ_WRITE_TOKEN
          ? ["BLOB_READ_WRITE_TOKEN"]
          : []),
      ];
      return json(request, {
        epicure: true,
        recipe: missingRecipe.length === 0,
        nutrition: missingNutrition.length === 0,
        image: missingImage.length === 0,
        freeImage: Boolean(process.env.POLLINATIONS_API_KEY),
        missing: {
          recipe: missingRecipe,
          nutrition: missingNutrition,
          image: missingImage,
        },
        models: {
          recipe: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro",
          image:
            process.env.POLLINATIONS_API_KEY?.trim()
              ? "pollinations-free (authenticated)"
              : process.env.GEMINI_IMAGE_MODEL?.trim() ||
                "gemini-3.1-flash-image",
          imageFallback: process.env.GEMINI_API_KEY
            ? process.env.GEMINI_IMAGE_MODEL?.trim() ||
              "gemini-3.1-flash-image"
            : "none",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
      }
      return publicError(request, error);
    }
  },
};
