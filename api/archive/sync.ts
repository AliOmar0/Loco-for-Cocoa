import { requireOwner } from "../../server/auth";
import { saveArchive } from "../../server/database";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors";
import { archiveSchema } from "../../server/validation";
import type { Recipe, RecipeCollection } from "../../src/types";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      const owner = await requireOwner(request);
      const parsed = archiveSchema.safeParse(await request.json());
      if (!parsed.success) {
        return json(request, { error: "The archive payload is invalid." }, 400);
      }
      const archive = await saveArchive(
        owner.email,
        parsed.data.recipes as Recipe[],
        parsed.data.collections as RecipeCollection[],
      );
      return json(request, archive);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
      }
      return publicError(request, error);
    }
  },
};
