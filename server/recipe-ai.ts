import { list, put } from "@vercel/blob";
import { z } from "zod";
import type { EpicurePairings } from "./epicure.js";

export const recipeGenerationRequestSchema = z.object({
  ingredients: z.array(z.string().min(1).max(120)).min(1).max(12),
  category: z.enum(["cake", "cookie", "no-bake", "breakfast"]),
  complexity: z.enum(["Easy", "Medium", "Project"]),
  servings: z.number().int().min(1).max(40),
  cuisine: z.string().max(120).default(""),
  specialRequests: z.string().max(1200).default(""),
  avoidIngredients: z.array(z.string().min(1).max(120)).max(20).default([]),
  directRecipe: z.string().max(120).default(""),
  timeTarget: z
    .enum(["quick", "standard", "weekend", "overnight"])
    .default("standard"),
  equipment: z
    .array(
      z.enum([
        "one-bowl",
        "no-mixer",
        "food-processor",
        "stovetop",
        "freezer",
        "oven",
      ]),
    )
    .max(6)
    .default([]),
  occasion: z
    .enum(["weeknight", "party", "gift", "brunch", "prep-ahead"])
    .default("weeknight"),
  finishStyle: z
    .enum(["rustic", "glossy", "bakery", "minimal", "dramatic"])
    .default("bakery"),
  pairingIntent: z
    .enum(["comfort", "balanced", "adventurous"])
    .default("balanced"),
  sweetness: z.number().int().min(1).max(5).default(3),
  texture: z
    .enum(["fudgy", "creamy", "crisp", "airy", "chewy"])
    .default("fudgy"),
  zeroAddedSugar: z.boolean().default(false),
  vegetarian: z.boolean().default(false),
  plantBased: z.boolean().default(false),
  generateImage: z.boolean().default(true),
});

export const recipeThumbnailRequestSchema = z.object({
  title: z.string().min(2).max(90),
  imagePrompt: z.string().min(10).max(1800),
});

export type RecipeGenerationRequest = z.infer<
  typeof recipeGenerationRequestSchema
>;
export type RecipeThumbnailRequest = z.infer<
  typeof recipeThumbnailRequestSchema
>;

export class RecipeAiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "RecipeAiError";
    this.code = code;
    this.status = status;
  }
}

type BlobStoreStatus = {
  configured: boolean;
  ready: boolean;
  code?: string;
  message?: string;
};

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

function getBlobTokenProblem(token: string) {
  if (!token) {
    return {
      code: "BLOB_NOT_CONFIGURED",
      message: "Thumbnail storage needs BLOB_READ_WRITE_TOKEN in the Vercel project.",
      status: 503,
    };
  }
  if (token.includes("...") || token.includes("…") || token.length < 40) {
    return {
      code: "BLOB_TOKEN_TRUNCATED",
      message:
        "BLOB_READ_WRITE_TOKEN looks copied from a shortened preview. Paste the full Vercel Blob read-write token value, save it for Production and Preview, then redeploy.",
      status: 503,
    };
  }
  return null;
}

function safeBlobErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/vercel_blob_rw_[A-Za-z0-9._-]+/g, "[redacted Blob token]")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyBlobFailure(error: unknown) {
  const detail = safeBlobErrorMessage(error);
  const normalized = detail.toLowerCase();
  if (/unauthori[sz]ed|forbidden|invalid token|token|401|403/.test(normalized)) {
    return {
      code: "BLOB_TOKEN_REJECTED",
      status: 503,
      message:
        "Vercel Blob rejected BLOB_READ_WRITE_TOKEN. Reconnect the Blob store to this project, make sure the variable is assigned to Production and Preview, then redeploy.",
      detail,
    };
  }
  if (/not found|store|does not exist|disconnected|unknown/.test(normalized)) {
    return {
      code: "BLOB_STORE_UNAVAILABLE",
      status: 503,
      message:
        "The Blob token is present, but Vercel could not find or access the connected Blob store. Reconnect the store in Vercel Storage, then redeploy.",
      detail,
    };
  }
  if (/quota|limit|exceeded|too large|payload|size/.test(normalized)) {
    return {
      code: "BLOB_LIMIT_REACHED",
      status: 507,
      message:
        "The thumbnail was created, but Vercel Blob refused the upload because the store hit a size, quota, or request limit.",
      detail,
    };
  }
  if (/timeout|network|fetch failed|econn|socket|unreachable/.test(normalized)) {
    return {
      code: "BLOB_NETWORK_FAILED",
      status: 502,
      message:
        "The thumbnail was created, but the server could not reach Vercel Blob. Retry in a moment.",
      detail,
    };
  }
  return {
    code: "BLOB_UPLOAD_FAILED",
    status: 502,
    message:
      "The thumbnail was created, but Vercel Blob could not store it. Check the Blob store connection and redeploy.",
    detail,
  };
}

export async function checkBlobStoreStatus(): Promise<BlobStoreStatus> {
  const token = getBlobToken();
  const problem = getBlobTokenProblem(token);
  if (problem) {
    return {
      configured: Boolean(token),
      ready: false,
      code: problem.code,
      message: problem.message,
    };
  }

  try {
    await list({
      limit: 1,
      prefix: "recipes/",
      token,
    });
    return {
      configured: true,
      ready: true,
    };
  } catch (error) {
    const failure = classifyBlobFailure(error);
    return {
      configured: true,
      ready: false,
      code: failure.code,
      message: `${failure.message}${
        failure.detail ? ` Blob said: ${failure.detail}` : ""
      }`,
    };
  }
}

function normalizeEnum(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
}

const categorySchema = z.preprocess((value) => {
  const normalized = normalizeEnum(value);
  if (normalized.includes("cookie") || normalized.includes("brownie")) {
    return "cookie";
  }
  if (normalized.includes("no-bake") || normalized.includes("truffle")) {
    return "no-bake";
  }
  if (normalized.includes("breakfast")) return "breakfast";
  return "cake";
}, z.enum(["cake", "cookie", "no-bake", "breakfast"]));

const moodSchema = z.preprocess((value) => {
  const normalized = normalizeEnum(value);
  if (normalized.includes("cute") || normalized.includes("playful")) return "cute";
  if (normalized.includes("dramatic") || normalized.includes("elegant")) {
    return "dramatic";
  }
  if (normalized.includes("quick") || normalized.includes("urgent")) return "quick";
  return "cozy";
}, z.enum(["cozy", "cute", "dramatic", "quick"]));

const difficultySchema = z.preprocess((value) => {
  const normalized = normalizeEnum(value);
  if (normalized.includes("project") || normalized.includes("hard")) {
    return "Project";
  }
  if (normalized.includes("medium") || normalized.includes("moderate")) {
    return "Medium";
  }
  return "Easy";
}, z.enum(["Easy", "Medium", "Project"]));

const dietaryValues = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "egg-free",
  "nut-free",
  "zero-added-sugar",
] as const;

const generatedIngredientSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const grams = Number(value.match(/(\d+(?:\.\d+)?)\s*g\b/i)?.[1] || 0);
    return {
      display: value,
      name: value
        .replace(/^\s*[\d./-]+\s*(?:g|kg|ml|l|oz|cups?|tbsp|tsp)?\s*/i, "")
        .replace(/,.+$/, "")
        .trim(),
      grams,
    };
  }
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return {
      display: row.display || row.amount || row.ingredient || row.name,
      name: row.name || row.ingredient || row.display,
      grams: row.grams || row.gramWeight || row.weight || 0,
    };
  }
  return value;
}, z.object({
  display: z.coerce.string().min(2).max(180),
  name: z.coerce.string().min(1).max(120),
  grams: z.coerce.number().min(0).max(10000).catch(0),
}));

const generatedStepSchema = z.preprocess((value) => {
  if (typeof value === "string") return { text: value };
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return {
      text: row.text || row.instruction || row.method,
      duration: row.duration || row.minutes,
    };
  }
  return value;
}, z.object({
  text: z.coerce.string().min(4).max(800),
  duration: z.coerce.number().int().min(0).max(1440).optional().catch(undefined),
}));

const generatedRecipeSchema = z.object({
  title: z.coerce.string().min(2).max(90),
  subtitle: z.coerce.string().min(3).max(180),
  description: z.coerce.string().min(20).max(900),
  category: categorySchema,
  mood: moodSchema,
  time: z.coerce.number().int().min(1).max(1440),
  difficulty: difficultySchema,
  servings: z.coerce.number().int().min(1).max(40),
  realisticYield: z.coerce.string().min(2).max(180),
  kitchenMess: z.coerce.number().int().min(1).max(5).catch(2),
  dietary: z
    .array(z.string())
    .default([])
    .transform((values) =>
      values
        .map(normalizeEnum)
        .filter((value): value is (typeof dietaryValues)[number] =>
          dietaryValues.includes(value as (typeof dietaryValues)[number]),
        ),
    ),
  ingredients: z.array(generatedIngredientSchema).min(3).max(30),
  steps: z.array(generatedStepSchema).min(2).max(30),
  notes: z.coerce.string().min(3).max(1000),
  nutritionEstimate: z.object({
    calories: z.coerce.number().min(0).catch(0),
    protein: z.coerce.number().min(0).catch(0),
    carbohydrates: z.coerce.number().min(0).catch(0),
    fat: z.coerce.number().min(0).catch(0),
    sugar: z.coerce.number().min(0).catch(0),
    fiber: z.coerce.number().min(0).catch(0),
    sodium: z.coerce.number().min(0).catch(0),
  }).default({
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    sugar: 0,
    fiber: 0,
    sodium: 0,
  }),
  imagePrompt: z.coerce
    .string()
    .min(10)
    .max(1800)
    .default("Editorial food photograph of the finished dessert."),
});

type GeneratedRecipe = z.infer<typeof generatedRecipeSchema>;

type NutritionValues = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
};

export type NutritionResult = NutritionValues & {
  source: "USDA FoodData Central" | "AI estimate";
  basis: "per serving";
  coverage?: string;
  disclaimer: string;
};

function roundNutrition(values: Partial<NutritionValues>): NutritionValues {
  return {
    calories: Math.round(values.calories ?? 0),
    protein: Math.round((values.protein ?? 0) * 10) / 10,
    carbohydrates: Math.round((values.carbohydrates ?? 0) * 10) / 10,
    fat: Math.round((values.fat ?? 0) * 10) / 10,
    sugar: Math.round((values.sugar ?? 0) * 10) / 10,
    fiber: Math.round((values.fiber ?? 0) * 10) / 10,
    sodium: Math.round(values.sodium ?? 0),
  };
}

async function generateRecipeWithDeepSeek(
  request: RecipeGenerationRequest,
  pairings: EpicurePairings,
): Promise<GeneratedRecipe> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("DEEPSEEK_NOT_CONFIGURED");
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro";
  const system = `You are the recipe development engine for Loco for Cocoa, an editorial sweets archive.
Create reliable, food-safe recipes with sound baking ratios and precise measurements.
The supplied Epicure graph comes from a 4.14M-recipe ingredient embedding model. Use its bridges for interesting pairings, but do not force every suggestion.
If directRecipe is provided, treat it as the requested dessert, not a loose inspiration.
Respect timeTarget, equipment, occasion, finishStyle, sweetness, texture, and avoidIngredients.
Return valid JSON only. Nutrition is an estimate per serving and must be internally consistent with the ingredient quantities.
Every ingredient needs a readable display string, a plain USDA-searchable name, and its approximate gram weight.
Do not claim medical benefits. Avoid unsafe raw flour or raw egg instructions.
When zeroAddedSugar is true, use no added sugar, honey, syrups, molasses, agave, sweetened chocolate, juice concentrates, or hidden caloric sweeteners. Whole fruit and unsweetened ingredients are allowed. Include "zero-added-sugar" in dietary.`;
  const user = {
    brief: request,
    epicurePairingGraph: pairings.raw,
    outputShape: {
      title: "Editorial recipe title",
      subtitle: "One-line archive hook",
      description: "Why this dessert works",
      category: request.category,
      mood: "cozy | cute | dramatic | quick",
      time: 45,
      difficulty: request.complexity,
      servings: request.servings,
      realisticYield: "A playful realistic yield",
      kitchenMess: 2,
      dietary: ["vegetarian"],
      ingredients: [
        {
          display: "170 g dark chocolate, roughly chopped",
          name: "dark chocolate",
          grams: 170,
        },
      ],
      steps: [{ text: "One clear action.", duration: 5 }],
      notes: "One practical baker's note.",
      nutritionEstimate: {
        calories: 320,
        protein: 5,
        carbohydrates: 40,
        fat: 17,
        sugar: 27,
        fiber: 3,
        sodium: 120,
      },
      imagePrompt:
        "Professional editorial food photograph in English, no text or people.",
    },
  };
  let response: Response;
  try {
    response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: `Create this recipe as JSON:\n${JSON.stringify(user)}` },
        ],
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: 4000,
        temperature: 0.55,
        stream: false,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new RecipeAiError(
        "DEEPSEEK_TIMEOUT",
        "DeepSeek took too long to develop this recipe. Try again with fewer ingredients.",
        504,
      );
    }
    throw new RecipeAiError(
      "DEEPSEEK_UNREACHABLE",
      "DeepSeek could not be reached. Please try generating the recipe again.",
      503,
    );
  }

  const responseText = await response.text();
  let payload: {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  } = {};
  try {
    payload = JSON.parse(responseText) as typeof payload;
  } catch {
    throw new RecipeAiError(
      "DEEPSEEK_BAD_RESPONSE",
      "DeepSeek returned an unreadable response. Please try again.",
    );
  }
  if (!response.ok) {
    const providerMessage = payload.error?.message?.toLowerCase() || "";
    if (response.status === 401 || response.status === 403) {
      throw new RecipeAiError(
        "DEEPSEEK_KEY_REJECTED",
        "DeepSeek rejected the API key. Replace DEEPSEEK_API_KEY in Vercel and redeploy.",
        503,
      );
    }
    if (
      response.status === 402 ||
      providerMessage.includes("balance") ||
      providerMessage.includes("insufficient")
    ) {
      throw new RecipeAiError(
        "DEEPSEEK_BALANCE",
        "The DeepSeek account needs API credit before it can generate recipes.",
        503,
      );
    }
    if (response.status === 429) {
      throw new RecipeAiError(
        "DEEPSEEK_RATE_LIMIT",
        "DeepSeek is temporarily rate-limited. Wait a moment and try again.",
        429,
      );
    }
    throw new RecipeAiError(
      "DEEPSEEK_REQUEST_FAILED",
      payload.error?.message
        ? `DeepSeek could not generate the recipe: ${payload.error.message}`
        : "DeepSeek could not generate the recipe. Please try again.",
    );
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new RecipeAiError(
      "DEEPSEEK_EMPTY",
      "DeepSeek returned an empty recipe. Please try again.",
    );
  }
  try {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const generated = generatedRecipeSchema.parse(JSON.parse(cleaned));
    if (!request.zeroAddedSugar) return generated;
    const forbiddenAddedSugar =
      /\b(?:brown sugar|white sugar|caster sugar|powdered sugar|icing sugar|coconut sugar|honey|maple syrup|corn syrup|glucose syrup|agave|molasses|golden syrup|date syrup|fruit juice concentrate|sweetened chocolate)\b/i;
    const invalidIngredient = generated.ingredients.find((ingredient) =>
      forbiddenAddedSugar.test(ingredient.display),
    );
    if (invalidIngredient) {
      throw new RecipeAiError(
        "ZERO_ADDED_SUGAR_INVALID",
        `The generated draft included an added sweetener (${invalidIngredient.display}). Generate it again or turn off zero added sugar.`,
        422,
      );
    }
    return {
      ...generated,
      dietary: Array.from(
        new Set([...generated.dietary, "zero-added-sugar" as const]),
      ),
    };
  } catch (error) {
    if (error instanceof RecipeAiError) throw error;
    throw new RecipeAiError(
      "DEEPSEEK_INVALID_DRAFT",
      "DeepSeek returned an incomplete recipe draft. Generate it once more.",
    );
  }
}

function nutrientValue(
  nutrients: Array<{
    nutrientName?: string;
    nutrientNumber?: string;
    value?: number;
    unitName?: string;
  }>,
  names: string[],
  numbers: string[] = [],
) {
  const found = nutrients.find((item) => {
    const name = item.nutrientName?.toLowerCase() || "";
    return (
      names.some((candidate) => name === candidate || name.includes(candidate)) ||
      numbers.includes(item.nutrientNumber || "")
    );
  });
  return Number(found?.value || 0);
}

async function calculateUsdaNutrition(
  recipe: GeneratedRecipe,
): Promise<NutritionResult | null> {
  const apiKey = process.env.USDA_API_KEY?.trim();
  if (!apiKey) return null;
  const totals: NutritionValues = {
    calories: 0,
    protein: 0,
    carbohydrates: 0,
    fat: 0,
    sugar: 0,
    fiber: 0,
    sodium: 0,
  };

  const rows = await Promise.all(
    recipe.ingredients.slice(0, 18).map(async (ingredient) => {
      try {
        const response = await fetch(
          `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
          {
            method: "POST",
            signal: AbortSignal.timeout(10_000),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: ingredient.name,
              pageSize: 1,
              dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
            }),
          },
        );
        if (!response.ok) return null;
        const payload = (await response.json()) as {
          foods?: Array<{
            foodNutrients?: Array<{
              nutrientName?: string;
              nutrientNumber?: string;
              value?: number;
              unitName?: string;
            }>;
          }>;
        };
        const nutrients = payload.foods?.[0]?.foodNutrients;
        if (!nutrients?.length) return null;
        const multiplier = ingredient.grams / 100;
        return {
          calories: nutrientValue(nutrients, ["energy"], ["208"]) * multiplier,
          protein: nutrientValue(nutrients, ["protein"], ["203"]) * multiplier,
          carbohydrates:
            nutrientValue(nutrients, ["carbohydrate"], ["205"]) * multiplier,
          fat:
            nutrientValue(nutrients, ["total lipid", "total fat"], ["204"]) *
            multiplier,
          sugar:
            nutrientValue(nutrients, ["sugars, total", "total sugars"], ["269"]) *
            multiplier,
          fiber:
            nutrientValue(nutrients, ["fiber, total dietary"], ["291"]) *
            multiplier,
          sodium: nutrientValue(nutrients, ["sodium"], ["307"]) * multiplier,
        };
      } catch {
        return null;
      }
    }),
  );

  const matched = rows.filter(
    (row): row is NutritionValues => Boolean(row),
  );
  const minimumCoverage = Math.max(3, Math.ceil(recipe.ingredients.length * 0.65));
  if (matched.length < minimumCoverage) return null;
  for (const row of matched) {
    for (const key of Object.keys(totals) as Array<keyof NutritionValues>) {
      totals[key] += row[key];
    }
  }
  const perServing = Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [
      key,
      value / recipe.servings,
    ]),
  ) as NutritionValues;
  return {
    ...roundNutrition(perServing),
    source: "USDA FoodData Central",
    basis: "per serving",
    coverage: `${matched.length} of ${recipe.ingredients.length} ingredients matched`,
    disclaimer:
      "Calculated from approximate ingredient weights. Actual values vary by brand and preparation.",
  };
}

type GeneratedImageBytes = {
  base64: string;
  mimeType: string;
  provider: string;
};

function imageProviderError(
  status: number,
  providerMessage: string,
  provider: string,
) {
  const message = providerMessage.toLowerCase();
  if (status === 401 || status === 403) {
    return new RecipeAiError(
      "GOOGLE_IMAGE_KEY_REJECTED",
      "Google rejected GEMINI_API_KEY. Replace the key in Vercel, confirm image-generation access, then redeploy.",
      503,
    );
  }
  if (
    status === 402 ||
    message.includes("billing") ||
    message.includes("payment")
  ) {
    return new RecipeAiError(
      "GOOGLE_IMAGE_BILLING_REQUIRED",
      "Google image generation needs billing enabled on the project attached to GEMINI_API_KEY.",
      503,
    );
  }
  if (status === 429 || message.includes("quota")) {
    return new RecipeAiError(
      "GOOGLE_IMAGE_RATE_LIMIT",
      "Google image generation has reached its current quota. Wait a moment or review the project quota.",
      429,
    );
  }
  if (
    message.includes("location") ||
    message.includes("region") ||
    message.includes("country")
  ) {
    return new RecipeAiError(
      "GOOGLE_IMAGE_REGION_UNAVAILABLE",
      "Google image generation is unavailable to this project or region. Use a supported project location.",
      503,
    );
  }
  if (
    status === 404 ||
    message.includes("model") ||
    message.includes("permission") ||
    message.includes("not found")
  ) {
    return new RecipeAiError(
      "GOOGLE_IMAGE_MODEL_UNAVAILABLE",
      `${provider} is unavailable to this Google AI project. The server will try another image model.`,
      503,
    );
  }
  return new RecipeAiError(
    "GOOGLE_IMAGE_REQUEST_FAILED",
    `${provider} rejected the thumbnail request. Try a simpler image direction or check the Google AI project.`,
    502,
  );
}

function recipeImagePrompt(recipe: RecipeThumbnailRequest) {
  return `${recipe.imagePrompt}. Create a finished ${recipe.title} as a cozy cinematic dessert editorial photograph. Macro food photography, 85mm lens, controlled warm window light, tactile crumbs, glossy texture, sophisticated cocoa-and-cream palette, 4:3 landscape composition. No text, no logo, no people, no hands.`;
}

async function generateWithGeminiImage(
  recipe: RecipeThumbnailRequest,
  apiKey: string,
  model: string,
  timeoutMs: number,
): Promise<GeneratedImageBytes> {
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: recipeImagePrompt(recipe) }],
            },
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new RecipeAiError(
        "GOOGLE_IMAGE_TIMEOUT",
        `${model} took too long to render the thumbnail. Try generating it again.`,
        504,
      );
    }
    throw new RecipeAiError(
      "GOOGLE_IMAGE_UNREACHABLE",
      "Google image generation could not be reached. Try again in a moment.",
      503,
    );
  }

  const responseText = await response.text();
  let payload: {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          inlineData?: { data?: string; mimeType?: string };
          inline_data?: { data?: string; mime_type?: string };
        }>;
      };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
    error?: { message?: string };
  } = {};
  try {
    payload = JSON.parse(responseText) as typeof payload;
  } catch {
    throw new RecipeAiError(
      "GOOGLE_IMAGE_BAD_RESPONSE",
      `${model} returned an unreadable response.`,
    );
  }
  if (!response.ok) {
    throw imageProviderError(
      response.status,
      payload.error?.message || responseText,
      model,
    );
  }
  const parts = payload.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find(
    (part) => part.inlineData?.data || part.inline_data?.data,
  );
  const base64 =
    imagePart?.inlineData?.data || imagePart?.inline_data?.data || "";
  if (!base64) {
    throw new RecipeAiError(
      "GOOGLE_IMAGE_NO_IMAGE",
      payload.promptFeedback?.blockReason ||
      payload.candidates?.[0]?.finishReason
        ? `${model} filtered this thumbnail direction. Edit the image prompt and try again.`
        : `${model} completed without returning an image.`,
      422,
    );
  }
  return {
    base64,
    mimeType:
      imagePart?.inlineData?.mimeType ||
      imagePart?.inline_data?.mime_type ||
      "image/png",
    provider: model,
  };
}

async function generateWithImagen(
  recipe: RecipeThumbnailRequest,
  apiKey: string,
  timeoutMs: number,
): Promise<GeneratedImageBytes> {
  const provider = "imagen-4.0-generate-001";
  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${provider}:predict`,
      {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [{ prompt: recipeImagePrompt(recipe) }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "4:3",
            personGeneration: "dont_allow",
          },
        }),
      },
    );
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new RecipeAiError(
        "GOOGLE_IMAGE_TIMEOUT",
        "Imagen took too long to render the thumbnail. Try again.",
        504,
      );
    }
    throw new RecipeAiError(
      "GOOGLE_IMAGE_UNREACHABLE",
      "Google image generation could not be reached. Try again in a moment.",
      503,
    );
  }
  const responseText = await response.text();
  let payload: {
    predictions?: Array<{
      bytesBase64Encoded?: string;
      mimeType?: string;
      image?: { imageBytes?: string; mimeType?: string };
    }>;
    error?: { message?: string };
  } = {};
  try {
    payload = JSON.parse(responseText) as typeof payload;
  } catch {
    throw new RecipeAiError(
      "GOOGLE_IMAGE_BAD_RESPONSE",
      "Imagen returned an unreadable response.",
    );
  }
  if (!response.ok) {
    throw imageProviderError(
      response.status,
      payload.error?.message || responseText,
      provider,
    );
  }
  const prediction = payload.predictions?.[0];
  const base64 =
    prediction?.bytesBase64Encoded || prediction?.image?.imageBytes || "";
  if (!base64) {
    throw new RecipeAiError(
      "GOOGLE_IMAGE_NO_IMAGE",
      "Imagen completed without returning an image.",
      422,
    );
  }
  return {
    base64,
    mimeType:
      prediction?.mimeType || prediction?.image?.mimeType || "image/png",
    provider,
  };
}

async function generateWithPollinations(
  recipe: RecipeThumbnailRequest,
  timeoutMs: number,
): Promise<GeneratedImageBytes> {
  const prompt = recipeImagePrompt(recipe);
  const url = new URL(
    `https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}`,
  );
  url.searchParams.set("width", "1024");
  url.searchParams.set("height", "768");
  url.searchParams.set("seed", String(Date.now() % 2_147_483_647));
  const pollinationsKey = process.env.POLLINATIONS_API_KEY?.trim();
  if (!pollinationsKey) {
    throw new RecipeAiError(
      "FREE_IMAGE_NOT_CONFIGURED",
      "Free thumbnail generation needs a Pollinations API key. Creating the key does not require payment or a card.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        Accept: "image/avif,image/webp,image/jpeg,image/png",
        Authorization: `Bearer ${pollinationsKey}`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new RecipeAiError(
        "FREE_IMAGE_TIMEOUT",
        "The free community image renderer took too long. Try the thumbnail again.",
        504,
      );
    }
    throw new RecipeAiError(
      "FREE_IMAGE_UNREACHABLE",
      "The free community image renderer is temporarily unreachable.",
      503,
    );
  }

  const mimeType = response.headers.get("content-type")?.split(";")[0] || "";
  if (!response.ok || !mimeType.startsWith("image/")) {
    const message = await response.text().catch(() => "");
    console.error("Pollinations thumbnail request failed", {
      status: response.status,
      message: message.slice(0, 240),
    });
    throw new RecipeAiError(
      response.status === 429
        ? "FREE_IMAGE_RATE_LIMIT"
        : "FREE_IMAGE_REQUEST_FAILED",
      response.status === 429
        ? "The free image renderer is busy or rate-limited. Wait a moment and retry."
        : "The free image renderer could not complete this thumbnail.",
      response.status === 429 ? 429 : 502,
    );
  }

  return {
    base64: Buffer.from(await response.arrayBuffer()).toString("base64"),
    mimeType,
    provider: "pollinations-free",
  };
}

export async function generateRecipeThumbnail(
  recipe: RecipeThumbnailRequest,
  timeoutMs = 45_000,
): Promise<{ url: string; provider: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const pollinationsKey = process.env.POLLINATIONS_API_KEY?.trim();
  const blobToken = getBlobToken();
  const googleFallbackEnabled =
    process.env.ENABLE_GOOGLE_IMAGE_FALLBACK === "true";
  const imagenFallbackEnabled =
    googleFallbackEnabled &&
    process.env.ENABLE_IMAGEN_FALLBACK === "true";
  if (!pollinationsKey && !(apiKey && googleFallbackEnabled)) {
    throw new RecipeAiError(
      "FREE_IMAGE_NOT_CONFIGURED",
      "Free thumbnail generation is not connected. Add POLLINATIONS_API_KEY in Vercel, then redeploy. Google image fallback stays off unless ENABLE_GOOGLE_IMAGE_FALLBACK=true.",
      503,
    );
  }
  const blobProblem = getBlobTokenProblem(blobToken);
  if (blobProblem) {
    throw new RecipeAiError(
      blobProblem.code,
      blobProblem.message,
      blobProblem.status,
    );
  }

  const startedAt = Date.now();
  const preferredModel =
    process.env.GEMINI_IMAGE_MODEL?.trim() || "gemini-3.1-flash-image";
  const attempts: Array<{
    provider: string;
    run: (remainingMs: number) => Promise<GeneratedImageBytes>;
  }> = [
    ...(pollinationsKey
      ? [
          {
            provider: "pollinations-free",
            run: (remainingMs: number) =>
              generateWithPollinations(recipe, remainingMs),
          },
        ]
      : []),
    ...(apiKey && googleFallbackEnabled
      ? [
            {
              provider: preferredModel,
              run: (remainingMs: number) =>
                generateWithGeminiImage(
                  recipe,
                  apiKey,
                  preferredModel,
                  remainingMs,
                ),
            },
            ...(preferredModel === "gemini-2.5-flash-image"
              ? []
              : [
                  {
                    provider: "gemini-2.5-flash-image",
                    run: (remainingMs: number) =>
                      generateWithGeminiImage(
                        recipe,
                        apiKey,
                        "gemini-2.5-flash-image",
                        remainingMs,
                      ),
                  },
                ]),
            ...(imagenFallbackEnabled
              ? [
                  {
                    provider: "imagen-4.0-generate-001",
                    run: (remainingMs: number) =>
                      generateWithImagen(recipe, apiKey, remainingMs),
                  },
                ]
              : []),
        ]
      : []),
  ];

  let generated: GeneratedImageBytes | null = null;
  let lastError: RecipeAiError | null = null;
  for (const attempt of attempts) {
    const remainingMs = timeoutMs - (Date.now() - startedAt);
    if (remainingMs < 4_000) break;
    try {
      generated = await attempt.run(remainingMs);
      break;
    } catch (error) {
      lastError =
        error instanceof RecipeAiError
          ? error
          : new RecipeAiError(
              "IMAGE_PROVIDER_UNKNOWN",
              "The image provider failed unexpectedly.",
            );
      console.error("Recipe thumbnail provider failed", {
        provider: attempt.provider,
        code: lastError.code,
        status: lastError.status,
        message: lastError.message,
      });
      if (
        [
          "GOOGLE_IMAGE_KEY_REJECTED",
          "GOOGLE_IMAGE_BILLING_REQUIRED",
          "GOOGLE_IMAGE_RATE_LIMIT",
          "GOOGLE_IMAGE_REGION_UNAVAILABLE",
          "GOOGLE_IMAGE_TIMEOUT",
        ].includes(lastError.code)
      ) {
        continue;
      }
    }
  }
  if (!generated) {
    if (!pollinationsKey) {
      throw new RecipeAiError(
        "FREE_IMAGE_NOT_CONFIGURED",
        "The free image renderer is not connected. Add POLLINATIONS_API_KEY in Vercel and redeploy; Imagen is disabled by default to avoid paid or unavailable requests.",
        503,
      );
    }
    throw (
      lastError ||
      new RecipeAiError(
        "IMAGE_GENERATION_TIMEOUT",
        "The image models did not finish before the request deadline. Retry the thumbnail separately.",
        504,
      )
    );
  }

  const mimeType = generated.mimeType;
  const extension = mimeType.includes("jpeg")
    ? "jpg"
    : mimeType.includes("webp")
      ? "webp"
      : mimeType.includes("avif")
        ? "avif"
        : "png";
  try {
    const blob = await put(
      `recipes/ai/${Date.now()}-${recipe.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.${extension}`,
      Buffer.from(generated.base64, "base64"),
      {
        access: "public",
        addRandomSuffix: true,
        contentType: mimeType,
        token: blobToken,
      },
    );
    return { url: blob.url, provider: generated.provider };
  } catch (error) {
    const failure = classifyBlobFailure(error);
    console.error("Recipe thumbnail Blob upload failed", {
      provider: generated.provider,
      code: failure.code,
      message: failure.detail || "Unknown Blob error",
    });
    throw new RecipeAiError(
      failure.code,
      `${failure.message}${failure.detail ? ` Blob said: ${failure.detail}` : ""}`,
      failure.status,
    );
  }
}

export async function generateRecipePackage(
  request: RecipeGenerationRequest,
  pairings: EpicurePairings,
) {
  const generated = await generateRecipeWithDeepSeek(request, pairings);
  const [usdaNutrition, imageResult] = await Promise.all([
    calculateUsdaNutrition(generated),
    request.generateImage
      ? generateRecipeThumbnail(generated, 24_000)
          .then((result) => ({
            image: result.url,
            imageProvider: result.provider,
            warning: "",
            code: "",
          }))
          .catch((error: unknown) => ({
            image: "",
            imageProvider: "",
            warning:
              error instanceof RecipeAiError
                ? error.message
                : "The thumbnail could not be generated. Try it again from the recipe preview.",
            code:
              error instanceof RecipeAiError
                ? error.code
                : "IMAGE_UNKNOWN_ERROR",
          }))
      : Promise.resolve({
          image: "",
          imageProvider: "",
          warning: "",
          code: "IMAGE_DISABLED",
        }),
  ]);
  const image = imageResult.image || null;
  const nutrition: NutritionResult =
    usdaNutrition || {
      ...roundNutrition(generated.nutritionEstimate),
      source: "AI estimate",
      basis: "per serving",
      disclaimer:
        "Estimated by AI from the written recipe. Verify independently for medical or dietary decisions.",
    };

  return {
    recipe: {
      ...generated,
      ingredients: generated.ingredients.map((ingredient) => ingredient.display),
      nutrition,
      ...(image ? { image } : {}),
    },
    pairings,
    providers: {
      recipe: process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro",
      nutrition: nutrition.source,
      image: image ? imageResult.imageProvider : null,
    },
    imageGeneration: {
      status: image
        ? "generated"
        : request.generateImage
          ? "failed"
          : "skipped",
      code: imageResult.code || undefined,
      message: imageResult.warning || undefined,
    },
    warnings: [
      ...(!process.env.USDA_API_KEY
        ? ["USDA_API_KEY is not configured, so nutrition is an AI estimate."]
        : []),
      ...(imageResult.warning ? [imageResult.warning] : []),
    ],
  };
}
