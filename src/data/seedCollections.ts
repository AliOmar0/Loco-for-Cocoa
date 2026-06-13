import type { RecipeCollection } from "../types";

export const seedCollections: RecipeCollection[] = [
  {
    id: "one-bowl",
    label: "One bowl",
    note: "Low cleanup, high reward",
    description: "The shortest route from craving to cooling rack.",
    recipeIds: ["midnight-chocolate-cake", "brown-butter-chunk-cookies"],
    enabled: true,
    accent: "#d83252",
  },
  {
    id: "no-oven",
    label: "No oven",
    note: "Cool kitchen behavior",
    description: "No preheating, no waiting for the kitchen to recover.",
    recipeIds: ["ten-minute-tiramisu-cups", "salted-cocoa-truffles"],
    enabled: true,
    accent: "#8f4d2f",
  },
  {
    id: "fifteen",
    label: "15 minutes",
    note: "The craving is urgent",
    description: "Fast sweets for an emotionally immediate dessert situation.",
    recipeIds: ["ten-minute-tiramisu-cups"],
    enabled: true,
    accent: "#efc272",
  },
  {
    id: "weekend",
    label: "Weekend project",
    note: "Make an afternoon of it",
    description: "Long-form baking with a very photogenic ending.",
    recipeIds: ["midnight-chocolate-cake", "cinnamon-roll-french-toast"],
    enabled: true,
    accent: "#f196a6",
  },
];
