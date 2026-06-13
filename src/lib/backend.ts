import type { Recipe, RecipeCollection } from "../types";

const deployedOnVercel =
  typeof window !== "undefined" && window.location.hostname.endsWith(".vercel.app")
    ? window.location.origin
    : "";
const apiUrl = (import.meta.env.VITE_API_URL || deployedOnVercel).replace(
  /\/+$/,
  "",
);

export const backendConfigured = Boolean(apiUrl);

export type AuthSession = {
  token: string;
  user: { id: string; email: string; name?: string };
};

export type CloudArchive = {
  recipes: Recipe[];
  collections: RecipeCollection[];
  version: number;
  updatedAt: string | null;
  initialized: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!apiUrl) throw new Error("The Vercel API is not configured yet.");
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.text();
    try {
      const parsed = JSON.parse(body) as { error?: string };
      throw new Error(
        parsed.error || `API request failed with ${response.status}.`,
      );
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(
          body || `API request failed with ${response.status}.`,
          { cause: error },
        );
      }
      throw error;
    }
  }
  return response.json() as Promise<T>;
}

export function loginOwner(email: string, password: string) {
  return request<AuthSession>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function uploadRecipeImage(file: File, token: string) {
  if (!apiUrl) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Unable to read that image."));
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(file);
    });
  }
  const { upload } = await import("@vercel/blob/client");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const blob = await upload(`recipes/${Date.now()}-${safeName}`, file, {
    access: "public",
    handleUploadUrl: `${apiUrl}/api/uploads`,
    headers: { Authorization: `Bearer ${token}` },
    contentType: file.type,
    multipart: file.size > 4 * 1024 * 1024,
  });
  return blob.url;
}

export function getCloudArchive(token: string) {
  return request<CloudArchive>("/api/archive", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getPublicArchive() {
  return request<CloudArchive>("/api/public/archive");
}

function getVisitorId() {
  const storageKey = "loco-for-cocoa-visitor";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;
  const visitorId = window.crypto.randomUUID();
  window.localStorage.setItem(storageKey, visitorId);
  return visitorId;
}

export function recordRecipeView(recipeId: string) {
  if (!backendConfigured) return Promise.resolve({ ok: false });
  return request<{ ok: boolean }>("/api/public/views", {
    method: "POST",
    body: JSON.stringify({ recipeId, visitorId: getVisitorId() }),
  });
}

export function syncArchive(
  recipes: Recipe[],
  collections: RecipeCollection[],
  token: string,
) {
  return request<CloudArchive>("/api/archive/sync", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipes, collections }),
  });
}
