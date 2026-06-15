import { put } from "@vercel/blob";
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
  pairingIntent: z
    .enum(["comfort", "balanced", "adventurous"])
    .default("balanced"),
  sweetness: z.number().int().min(1).max(5).default(3),
  texture: z
    .enum(["fudgy", "creamy", "crisp", "airy", "chewy"])
    .default("fudgy"),
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

function roundNutrition(values: NutritionValues): NutritionValues {
  return {
    calories: Math.round(values.calories),
    protein: Math.round(values.protein * 10) / 10,
    carbohydrates: Math.round(values.carbohydrates * 10) / 10,
    fat: Math.round(values.fat * 10) / 10,
    sugar: Math.round(values.sugar * 10) / 10,
    fiber: Math.round(values.fiber * 10) / 10,
    sodium: Math.round(values.sodium),
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
Return valid JSON only. Nutrition is an estimate per serving and must be internally consistent with the ingredient quantities.
Every ingredient needs a readable display string, a plain USDA-searchable name, and its approximate gram weight.
Do not claim medical benefits. Avoid unsafe raw flour or raw egg instructions.`;
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
    return generatedRecipeSchema.parse(JSON.parse(cleaned));
  } catch {
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

function imageProviderError(status: number, providerMessage: string) {
  const message = providerMessage.toLowerCase();
  if (status === 401 || status === 403) {
    return new RecipeAiError(
      "IMAGEN_KEY_REJECTED",
      "Google rejected GEMINI_API_KEY. Replace the key in Vercel, confirm it can use Imagen, then redeploy.",
      503,
    );
  }
  if (
    status === 402 ||
    message.includes("billing") ||
    message.includes("payment")
  ) {
    return new RecipeAiError(
      "IMAGEN_BILLING_REQUIRED",
      "Imagen needs billing enabled on the Google AI project attached to GEMINI_API_KEY.",
      503,
    );
  }
  if (status === 429 || message.includes("quota")) {
    return new RecipeAiError(
      "IMAGEN_RATE_LIMIT",
      "Imagen has reached its current quota. Wait a moment or review the Google AI project quota.",
      429,
    );
  }
  if (
    message.includes("location") ||
    message.includes("region") ||
    message.includes("country")
  ) {
    return new RecipeAiError(
      "IMAGEN_REGION_UNAVAILABLE",
      "Imagen is not available to this Google AI project or region. Use a supported project location.",
      503,
    );
  }
  if (message.includes("model") || message.includes("permission")) {
    return new RecipeAiError(
      "IMAGEN_MODEL_UNAVAILABLE",
      "This Google AI project does not currently have access to Imagen 4. Check model access and billing.",
      503,
    );
  }
  return new RecipeAiError(
    "IMAGEN_REQUEST_FAILED",
    "Imagen rejected the thumbnail request. Try a simpler image direction or check the Google AI project.",
    502,
  );
}

export async function generateRecipeThumbnail(
  recipe: RecipeThumbnailRequest,
  timeoutMs = 45_000,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!apiKey) {
    throw new RecipeAiError(
      "IMAGEN_NOT_CONFIGURED",
      "Thumbnail generation needs GEMINI_API_KEY in the Vercel project.",
      503,
    );
  }
  if (!blobToken) {
    throw new RecipeAiError(
      "BLOB_NOT_CONFIGURED",
      "Thumbnail storage needs BLOB_READ_WRITE_TOKEN in the Vercel project.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict",
      {
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: `${recipe.imagePrompt}. A finished ${recipe.title}, cozy cinematic dessert editorial, macro food photography, 85mm lens, controlled warm window light, tactile crumbs and glossy texture, sophisticated cocoa-and-cream palette, no text, no logo, no people.`,
            },
          ],
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
        "IMAGEN_TIMEOUT",
        "Imagen took too long to render the thumbnail. Try generating it again.",
        504,
      );
    }
    throw new RecipeAiError(
      "IMAGEN_UNREACHABLE",
      "Google Imagen could not be reached. Try the thumbnail again in a moment.",
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
    generatedImages?: Array<{
      image?: { imageBytes?: string; mimeType?: string };
    }>;
    error?: { message?: string };
    filteredReason?: string;
  } = {};
  try {
    payload = JSON.parse(responseText) as typeof payload;
  } catch {
    throw new RecipeAiError(
      "IMAGEN_BAD_RESPONSE",
      "Imagen returned an unreadable response. Try generating the thumbnail again.",
    );
  }
  if (!response.ok) {
    throw imageProviderError(
      response.status,
      payload.error?.message || responseText,
    );
  }

  const prediction = payload.predictions?.[0];
  const generatedImage = payload.generatedImages?.[0]?.image;
  const base64 =
    prediction?.bytesBase64Encoded ||
    prediction?.image?.imageBytes ||
    generatedImage?.imageBytes;
  if (!base64) {
    throw new RecipeAiError(
      "IMAGEN_NO_IMAGE",
      payload.filteredReason
        ? "Imagen filtered this thumbnail direction. Edit the image prompt and try again."
        : "Imagen completed the request without returning an image. Try a simpler image direction.",
      422,
    );
  }
  const mimeType =
    prediction?.mimeType ||
    prediction?.image?.mimeType ||
    generatedImage?.mimeType ||
    "image/png";
  const extension = mimeType.includes("jpeg") ? "jpg" : "png";
  try {
    const blob = await put(
      `recipes/ai/${Date.now()}-${recipe.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}.${extension}`,
      Buffer.from(base64, "base64"),
      {
        access: "public",
        addRandomSuffix: true,
        contentType: mimeType,
        token: blobToken,
      },
    );
    return blob.url;
  } catch {
    throw new RecipeAiError(
      "BLOB_UPLOAD_FAILED",
      "Imagen created the thumbnail, but Vercel Blob could not store it. Reconnect the Blob store and retry.",
      502,
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
          .then((image) => ({ image, warning: "", code: "" }))
          .catch((error: unknown) => ({
            image: "",
            warning:
              error instanceof RecipeAiError
                ? error.message
                : "The thumbnail could not be generated. Try it again from the recipe preview.",
            code:
              error instanceof RecipeAiError
                ? error.code
                : "IMAGEN_UNKNOWN_ERROR",
          }))
      : Promise.resolve({
          image: "",
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
      image: image ? "Google Imagen 4" : null,
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
