export type RecipeCategory = "cake" | "cookie" | "no-bake" | "breakfast";
export type RecipeMood = "cozy" | "cute" | "dramatic" | "quick";
export type RecipeDifficulty = "Easy" | "Medium" | "Project";
export type DietaryTag =
  | "vegetarian"
  | "vegan"
  | "gluten-free"
  | "dairy-free"
  | "egg-free"
  | "nut-free";

export type RecipeStep = {
  text: string;
  duration?: number;
};

export type NutritionInfo = {
  calories: number;
  protein: number;
  carbohydrates: number;
  fat: number;
  sugar: number;
  fiber: number;
  sodium: number;
  source: "USDA FoodData Central" | "AI estimate";
  basis: "per serving";
  coverage?: string;
  disclaimer: string;
};

export type ImageFocus = {
  x: number;
  y: number;
  zoom: number;
};

export type SubstitutionOption = {
  label: string;
  amount: string;
  note: string;
  dietary: DietaryTag[];
  reliable: boolean;
};

export type IngredientSubstitution = {
  match: string;
  options: SubstitutionOption[];
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
  imageFocus?: ImageFocus;
  ingredients: string[];
  dietary?: DietaryTag[];
  nutrition?: NutritionInfo;
  substitutions?: IngredientSubstitution[];
  steps: RecipeStep[];
  notes: string;
  kitchenMess?: 1 | 2 | 3 | 4 | 5;
  realisticYield?: string;
  rating: number;
  saves: number;
  views?: number;
  accent: [string, string];
  createdAt: string;
  updatedAt: string;
};

export type RecipeRevision = {
  id: string;
  savedAt: string;
  recipe: Recipe;
};

export type RecipeCollection = {
  id: string;
  label: string;
  note: string;
  description: string;
  recipeIds: string[];
  enabled: boolean;
  accent: string;
};

export type BakeTimerState = {
  remaining: number;
  running: boolean;
  updatedAt: number;
};

export type BakeSession = {
  recipeId: string;
  completed: number[];
  checkedIngredients: number[];
  activeStep: number;
  servings: number;
  realisticPortions: boolean;
  bakeMode: boolean;
  timers: Record<number, BakeTimerState>;
  updatedAt: string;
};

export type ComfortPreferences = {
  fontScale: "compact" | "default" | "large";
  contrast: "default" | "high";
  reducedIntensity: boolean;
  sounds: boolean;
  cursorEffects: boolean;
};
