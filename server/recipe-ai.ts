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
  vegetarian: z.boolean().default(false),
  plantBased: z.boolean().default(false),
  generateImage: z.boolean().default(true),
});

export type RecipeGenerationRequest = z.infer<
  typeof recipeGenerationRequestSchema
>;

const generatedRecipeSchema = z.object({
  title: z.string().min(2).max(90),
  subtitle: z.string().min(3).max(180),
  description: z.string().min(20).max(900),
  category: z.enum(["cake", "cookie", "no-bake", "breakfast"]),
  mood: z.enum(["cozy", "cute", "dramatic", "quick"]),
  time: z.number().int().min(1).max(1440),
  difficulty: z.enum(["Easy", "Medium", "Project"]),
  servings: z.number().int().min(1).max(40),
  realisticYield: z.string().min(2).max(180),
  kitchenMess: z.number().int().min(1).max(5),
  dietary: z.array(
    z.enum([
      "vegetarian",
      "vegan",
      "gluten-free",
      "dairy-free",
      "egg-free",
      "nut-free",
    ]),
  ),
  ingredients: z
    .array(
      z.object({
        display: z.string().min(2).max(180),
        name: z.string().min(1).max(120),
        grams: z.number().min(0).max(10000),
      }),
    )
    .min(3)
    .max(30),
  steps: z
    .array(
      z.object({
        text: z.string().min(4).max(800),
        duration: z.number().int().min(0).max(1440).optional(),
      }),
    )
    .min(2)
    .max(30),
  notes: z.string().min(3).max(1000),
  nutritionEstimate: z.object({
    calories: z.number().min(0),
    protein: z.number().min(0),
    carbohydrates: z.number().min(0),
    fat: z.number().min(0),
    sugar: z.number().min(0),
    fiber: z.number().min(0),
    sodium: z.number().min(0),
  }),
  imagePrompt: z.string().min(20).max(1800),
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
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(40_000),
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
      response_format: { type: "json_object" },
      max_tokens: 6000,
      temperature: 0.65,
      stream: false,
    }),
  });
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(payload.error?.message || "DeepSeek could not generate the recipe.");
  }
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek returned an empty recipe.");
  return generatedRecipeSchema.parse(JSON.parse(content));
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

async function generateRecipeImage(recipe: GeneratedRecipe) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!apiKey || !blobToken) return null;
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict",
    {
      method: "POST",
      signal: AbortSignal.timeout(15_000),
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
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    predictions?: Array<{
      bytesBase64Encoded?: string;
      mimeType?: string;
      image?: { imageBytes?: string };
    }>;
  };
  const prediction = payload.predictions?.[0];
  const base64 =
    prediction?.bytesBase64Encoded || prediction?.image?.imageBytes;
  if (!base64) return null;
  const mimeType = prediction?.mimeType || "image/png";
  const extension = mimeType.includes("jpeg") ? "jpg" : "png";
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
}

export async function generateRecipePackage(
  request: RecipeGenerationRequest,
  pairings: EpicurePairings,
) {
  const generated = await generateRecipeWithDeepSeek(request, pairings);
  const [usdaNutrition, image] = await Promise.all([
    calculateUsdaNutrition(generated),
    request.generateImage
      ? generateRecipeImage(generated).catch(() => null)
      : Promise.resolve(null),
  ]);
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
    warnings: [
      ...(!process.env.USDA_API_KEY
        ? ["USDA_API_KEY is not configured, so nutrition is an AI estimate."]
        : []),
      ...(request.generateImage && !image
        ? [
            "The thumbnail could not be generated. Configure GEMINI_API_KEY and BLOB_READ_WRITE_TOKEN.",
          ]
        : []),
    ],
  };
}
