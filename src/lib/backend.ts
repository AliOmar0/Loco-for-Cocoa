import type {
  DietaryTag,
  NutritionInfo,
  Recipe,
  RecipeCategory,
  RecipeDifficulty,
  RecipeMood,
  RecipeStep,
  RecipeCollection,
  RecipeTranslation,
} from "../types";

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

export type EpicurePairings = {
  raw: string;
  clusters: Array<{
    id: string;
    label: string;
    ingredients: Array<{ name: string; score: number }>;
  }>;
  bridges: Array<{ name: string; connects: string[]; coverage: string }>;
  suggestions: string[];
};

export type AiRecipeRequest = {
  ingredients: string[];
  category: RecipeCategory;
  complexity: RecipeDifficulty;
  servings: number;
  cuisine: string;
  specialRequests: string;
  avoidIngredients: string[];
  pairingIntent: "comfort" | "balanced" | "adventurous";
  sweetness: number;
  texture: "fudgy" | "creamy" | "crisp" | "airy" | "chewy";
  zeroAddedSugar: boolean;
  vegetarian: boolean;
  plantBased: boolean;
  generateImage: boolean;
};

export type AiRecipeDraft = {
  title: string;
  subtitle: string;
  description: string;
  category: RecipeCategory;
  mood: RecipeMood;
  time: number;
  difficulty: RecipeDifficulty;
  servings: number;
  realisticYield: string;
  kitchenMess: number;
  dietary: DietaryTag[];
  ingredients: string[];
  steps: RecipeStep[];
  notes: string;
  nutrition: NutritionInfo;
  imagePrompt: string;
  image?: string;
};

export type AiRecipePackage = {
  recipe: AiRecipeDraft;
  pairings: EpicurePairings;
  providers: {
    recipe: string;
    nutrition: NutritionInfo["source"];
    image: string | null;
  };
  imageGeneration: {
    status: "generated" | "failed" | "skipped";
    code?: string;
    message?: string;
  };
  warnings: string[];
};

export type AiProviderStatus = {
  epicure: boolean;
  recipe: boolean;
  nutrition: boolean;
  image: boolean;
  freeImage: boolean;
  blob: {
    configured: boolean;
    ready: boolean;
    code?: string;
    message?: string;
  };
  missing: {
    recipe: string[];
    nutrition: string[];
    image: string[];
  };
  models: { recipe: string; image: string; imageFallback?: string };
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

export function getVisitorId() {
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

export function setRecipeSaved(recipeId: string, saved: boolean) {
  if (!backendConfigured) {
    return Promise.resolve({ ok: true, saved, saves: -1 });
  }
  return request<{ ok: boolean; saved: boolean; saves: number }>(
    "/api/public/saves",
    {
      method: "POST",
      body: JSON.stringify({
        recipeId,
        visitorId: getVisitorId(),
        saved,
      }),
    },
  );
}

export function getRecipeTranslation(
  recipeId: string,
  language: "ar",
) {
  if (!backendConfigured) {
    return Promise.reject(
      new Error(
        "Arabic translation is available when the site is connected to its Vercel backend.",
      ),
    );
  }
  return request<{ translation: RecipeTranslation; cached: boolean }>(
    "/api/public/translation",
    {
      method: "POST",
      body: JSON.stringify({ recipeId, language }),
    },
  );
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

export function getAiProviderStatus(token: string) {
  return request<AiProviderStatus>("/api/ai/status", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getEpicurePairings(
  payload: Pick<
    AiRecipeRequest,
    "ingredients" | "vegetarian" | "plantBased"
  >,
  token: string,
) {
  return request<EpicurePairings>("/api/ai/pairings", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function generateAiRecipe(payload: AiRecipeRequest, token: string) {
  return request<AiRecipePackage>("/api/ai/recipe", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function generateAiRecipeImage(
  payload: Pick<AiRecipeDraft, "title" | "imagePrompt">,
  token: string,
) {
  return request<{ image: string; provider: string }>("/api/ai/image", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}
