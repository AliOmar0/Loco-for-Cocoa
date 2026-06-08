import type { Recipe, RecipeCategory, RecipeMood } from "../types";

export const categoryLabels: Record<RecipeCategory, string> = {
  cake: "Cakes",
  cookie: "Cookies",
  "no-bake": "No-bake",
  breakfast: "Sweet breakfast",
};

export const moodLabels: Record<RecipeMood, string> = {
  cozy: "Cozy",
  cute: "Cute",
  dramatic: "Main character",
  quick: "Need it now",
};

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const fractionValues: Record<string, number> = {
  "1/4": 0.25,
  "1/3": 1 / 3,
  "1/2": 0.5,
  "2/3": 2 / 3,
  "3/4": 0.75,
};

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

export function scaleIngredient(line: string, scale: number) {
  if (scale === 1) return line;
  return line.replace(/^(\d+)?(?:\s+)?(\d\/\d)?/, (match, whole, fraction) => {
    if (!match.trim()) return match;
    const quantity = Number(whole || 0) + (fractionValues[fraction] || 0);
    if (!quantity) return match;
    return formatNumber(quantity * scale);
  });
}

export function recipeScore(
  recipe: Recipe,
  values: { rich: number; effort: number; playful: number },
) {
  const richness =
    recipe.category === "cake" ? 85 : recipe.category === "cookie" ? 70 : 58;
  const effort = Math.min(100, recipe.time * 1.35);
  const playful =
    recipe.mood === "cute" ? 95 : recipe.mood === "dramatic" ? 78 : 62;

  return (
    Math.abs(richness - values.rich) +
    Math.abs(effort - values.effort) +
    Math.abs(playful - values.playful)
  );
}

export function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
