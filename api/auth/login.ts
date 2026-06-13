import { authenticateOwner } from "../../server/auth";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../../server/cors";
import { loginSchema } from "../../server/validation";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      const parsed = loginSchema.safeParse(await request.json());
      if (!parsed.success) {
        return json(request, { error: "Enter a valid email and password." }, 400);
      }
      const session = await authenticateOwner(
        parsed.data.email,
        parsed.data.password,
      );
      if (!session) {
        return json(request, { error: "Email or password is incorrect." }, 401);
      }
      return json(request, session);
    } catch (error) {
      return publicError(request, error);
    }
  },
};
