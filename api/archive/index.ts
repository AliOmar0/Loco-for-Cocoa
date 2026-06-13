import { requireOwner } from "../../server/auth.js";
import { loadArchive } from "../../server/database.js";
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
      const owner = await requireOwner(request);
      return json(request, await loadArchive(owner.email));
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
      }
      return publicError(request, error);
    }
  },
};
