export type RecipeCategory = "cake" | "cookie" | "no-bake" | "breakfast";
export type RecipeMood = "cozy" | "cute" | "dramatic" | "quick";
export type RecipeDifficulty = "Easy" | "Medium" | "Project";

export type RecipeStep = {
  text: string;
  duration?: number;
};

export type Recipe = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  category: RecipeCategory;
  mood: RecipeMood;
  time: number;
  difficulty: RecipeDifficulty;
  servings: number;
  featured: boolean;
  published: boolean;
  image: string;
  ingredients: string[];
  steps: RecipeStep[];
  notes: string;
  rating: number;
  saves: number;
  accent: [string, string];
  createdAt: string;
  updatedAt: string;
};
