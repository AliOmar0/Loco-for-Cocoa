import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireOwner } from "../server/auth";
import {
  json,
  methodNotAllowed,
  preflight,
  publicError,
} from "../server/cors";

export default {
  async fetch(request: Request) {
    if (request.method === "OPTIONS") return preflight(request);
    if (request.method !== "POST") return methodNotAllowed(request, ["POST"]);

    try {
      const body = (await request.json()) as HandleUploadBody;
      const result = await handleUpload({
        request,
        body,
        onBeforeGenerateToken: async () => {
          const owner = await requireOwner(request);
          return {
            allowedContentTypes: [
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/avif",
            ],
            maximumSizeInBytes: 15 * 1024 * 1024,
            addRandomSuffix: true,
            tokenPayload: JSON.stringify({ ownerEmail: owner.email }),
          };
        },
        onUploadCompleted: async ({ blob }) => {
          console.info("Recipe image uploaded:", blob.pathname);
        },
      });
      return json(request, result);
    } catch (error) {
      if (error instanceof Error && error.message === "UNAUTHORIZED") {
        return json(request, { error: "Your Studio session has expired." }, 401);
      }
      return publicError(request, error);
    }
  },
};
