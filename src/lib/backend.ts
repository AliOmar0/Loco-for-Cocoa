import type { Recipe, RecipeCollection } from "../types";

const apiUrl = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

export const backendConfigured = Boolean(apiUrl);

export type AuthSession = {
  token: string;
  user: { id: string; email: string; name?: string };
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
    const message = await response.text();
    throw new Error(message || `API request failed with ${response.status}.`);
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
  const form = new FormData();
  form.append("image", file);
  const response = await fetch(`${apiUrl}/api/uploads`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok) throw new Error(await response.text());
  return (await response.json() as { url: string }).url;
}

export function syncArchive(
  recipes: Recipe[],
  collections: RecipeCollection[],
  token: string,
) {
  return request<{ recipes: Recipe[]; collections: RecipeCollection[] }>(
    "/api/archive/sync",
    {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ recipes, collections }),
    },
  );
}
