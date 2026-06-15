import { z } from "zod";
import type { Recipe, RecipeTranslation } from "../src/types.js";

const arabicTranslationSchema = z.object({
  title: z.string().min(2).max(180),
  subtitle: z.string().min(2).max(240),
  description: z.string().min(10).max(1200),
  realisticYield: z.string().max(240).optional(),
  ingredients: z.array(z.string().min(2).max(240)).min(1).max(200),
  steps: z.array(z.string().min(4).max(1000)).min(1).max(100),
  notes: z.string().min(2).max(1400),
});

export class RecipeTranslationError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "RecipeTranslationError";
    this.status = status;
  }
}

export async function translateRecipeToArabic(
  recipe: Recipe,
): Promise<RecipeTranslation> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    throw new RecipeTranslationError(
      "Arabic translation is temporarily unavailable.",
      503,
    );
  }
  const model = process.env.DEEPSEEK_MODEL?.trim() || "deepseek-v4-pro";
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
          {
            role: "system",
            content:
              "Translate recipes into natural Modern Standard Arabic for home bakers. Return JSON only. Preserve every quantity, fraction, temperature, timer, and ingredient meaning exactly. Translate measurement unit names into familiar Arabic while keeping Western numerals. Do not add, remove, or reinterpret instructions.",
          },
          {
            role: "user",
            content: JSON.stringify({
              title: recipe.title,
              subtitle: recipe.subtitle,
              description: recipe.description,
              realisticYield: recipe.realisticYield,
              ingredients: recipe.ingredients,
              steps: recipe.steps.map((step) => step.text),
              notes: recipe.notes,
            }),
          },
        ],
        thinking: { type: "disabled" },
        response_format: { type: "json_object" },
        max_tokens: 4000,
        temperature: 0.15,
        stream: false,
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new RecipeTranslationError(
        "Arabic translation took too long. Please try again.",
        504,
      );
    }
    throw new RecipeTranslationError(
      "Arabic translation could not be reached. Please try again.",
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
    throw new RecipeTranslationError(
      "Arabic translation returned an unreadable response.",
    );
  }
  if (!response.ok) {
    console.error("Arabic recipe translation failed", {
      status: response.status,
      providerMessage: payload.error?.message || "Unknown DeepSeek error",
    });
    if (response.status === 429) {
      throw new RecipeTranslationError(
        "Arabic translation is busy right now. Please try again shortly.",
        429,
      );
    }
    throw new RecipeTranslationError(
      "Arabic translation could not be completed.",
      502,
    );
  }

  const content = payload.choices?.[0]?.message?.content;
  if (!content) {
    throw new RecipeTranslationError(
      "Arabic translation returned an empty response.",
    );
  }
  try {
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const translated = arabicTranslationSchema.parse(JSON.parse(cleaned));
    if (
      translated.ingredients.length !== recipe.ingredients.length ||
      translated.steps.length !== recipe.steps.length
    ) {
      throw new Error("Translation changed the recipe structure.");
    }
    return {
      language: "ar",
      ...translated,
    };
  } catch {
    throw new RecipeTranslationError(
      "Arabic translation changed the recipe structure. Please try again.",
    );
  }
}
