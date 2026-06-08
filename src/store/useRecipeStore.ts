import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seedRecipes } from "../data/seedRecipes";
import type { Recipe } from "../types";

type RecipeStore = {
  recipes: Recipe[];
  favorites: string[];
  upsertRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  duplicateRecipe: (id: string) => string | undefined;
  toggleFavorite: (id: string) => void;
  togglePublished: (id: string) => void;
  replaceRecipes: (recipes: Recipe[]) => void;
  resetRecipes: () => void;
};

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: seedRecipes,
      favorites: [],
      upsertRecipe: (recipe) =>
        set((state) => {
          const exists = state.recipes.some((item) => item.id === recipe.id);
          return {
            recipes: exists
              ? state.recipes.map((item) => (item.id === recipe.id ? recipe : item))
              : [recipe, ...state.recipes],
          };
        }),
      deleteRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
          favorites: state.favorites.filter((favorite) => favorite !== id),
        })),
      duplicateRecipe: (id) => {
        const source = get().recipes.find((recipe) => recipe.id === id);
        if (!source) return undefined;
        const copyId = `${source.id}-copy-${Date.now().toString().slice(-5)}`;
        const now = new Date().toISOString();
        set((state) => ({
          recipes: [
            {
              ...source,
              id: copyId,
              title: `${source.title} Copy`,
              published: false,
              featured: false,
              createdAt: now,
              updatedAt: now,
            },
            ...state.recipes,
          ],
        }));
        return copyId;
      },
      toggleFavorite: (id) =>
        set((state) => ({
          favorites: state.favorites.includes(id)
            ? state.favorites.filter((favorite) => favorite !== id)
            : [...state.favorites, id],
        })),
      togglePublished: (id) =>
        set((state) => ({
          recipes: state.recipes.map((recipe) =>
            recipe.id === id
              ? {
                  ...recipe,
                  published: !recipe.published,
                  updatedAt: new Date().toISOString(),
                }
              : recipe,
          ),
        })),
      replaceRecipes: (recipes) => set({ recipes }),
      resetRecipes: () => set({ recipes: seedRecipes, favorites: [] }),
    }),
    {
      name: "loco-for-cocoa-react-v2",
      version: 2,
    },
  ),
);
