import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seedRecipes } from "../data/seedRecipes";
import { seedCollections } from "../data/seedCollections";
import type { Recipe, RecipeCollection, RecipeRevision } from "../types";

type RecipeStore = {
  recipes: Recipe[];
  favorites: string[];
  revisions: Record<string, RecipeRevision[]>;
  collections: RecipeCollection[];
  upsertRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  duplicateRecipe: (id: string) => string | undefined;
  toggleFavorite: (id: string) => void;
  togglePublished: (id: string) => void;
  replaceRecipes: (recipes: Recipe[]) => void;
  replaceCollections: (collections: RecipeCollection[]) => void;
  restoreRevision: (recipeId: string, revisionId: string) => void;
  upsertCollection: (collection: RecipeCollection) => void;
  deleteCollection: (id: string) => void;
  reorderCollections: (ids: string[]) => void;
  resetRecipes: () => void;
};

export const useRecipeStore = create<RecipeStore>()(
  persist(
    (set, get) => ({
      recipes: seedRecipes,
      favorites: [],
      revisions: {},
      collections: seedCollections,
      upsertRecipe: (recipe) =>
        set((state) => {
          const previous = state.recipes.find((item) => item.id === recipe.id);
          const revision = previous
            ? {
                id: `${recipe.id}-${Date.now()}`,
                savedAt: new Date().toISOString(),
                recipe: previous,
              }
            : null;
          return {
            recipes: previous
              ? state.recipes.map((item) => (item.id === recipe.id ? recipe : item))
              : [recipe, ...state.recipes],
            revisions: revision
              ? {
                  ...state.revisions,
                  [recipe.id]: [
                    revision,
                    ...(state.revisions[recipe.id] || []),
                  ].slice(0, 12),
                }
              : state.revisions,
          };
        }),
      deleteRecipe: (id) =>
        set((state) => ({
          recipes: state.recipes.filter((recipe) => recipe.id !== id),
          favorites: state.favorites.filter((favorite) => favorite !== id),
          revisions: Object.fromEntries(
            Object.entries(state.revisions).filter(([recipeId]) => recipeId !== id),
          ),
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
      replaceCollections: (collections) => set({ collections }),
      restoreRevision: (recipeId, revisionId) =>
        set((state) => {
          const revision = state.revisions[recipeId]?.find(
            (item) => item.id === revisionId,
          );
          const current = state.recipes.find((item) => item.id === recipeId);
          if (!revision || !current) return state;
          const restored = {
            ...revision.recipe,
            updatedAt: new Date().toISOString(),
          };
          return {
            recipes: state.recipes.map((item) =>
              item.id === recipeId ? restored : item,
            ),
            revisions: {
              ...state.revisions,
              [recipeId]: [
                {
                  id: `${recipeId}-${Date.now()}`,
                  savedAt: new Date().toISOString(),
                  recipe: current,
                },
                ...(state.revisions[recipeId] || []).filter(
                  (item) => item.id !== revisionId,
                ),
              ].slice(0, 12),
            },
          };
        }),
      upsertCollection: (collection) =>
        set((state) => ({
          collections: state.collections.some((item) => item.id === collection.id)
            ? state.collections.map((item) =>
                item.id === collection.id ? collection : item,
              )
            : [...state.collections, collection],
        })),
      deleteCollection: (id) =>
        set((state) => ({
          collections: state.collections.filter((item) => item.id !== id),
        })),
      reorderCollections: (ids) =>
        set((state) => ({
          collections: ids
            .map((id) => state.collections.find((item) => item.id === id))
            .filter((item): item is RecipeCollection => Boolean(item)),
        })),
      resetRecipes: () =>
        set({
          recipes: seedRecipes,
          favorites: [],
          revisions: {},
          collections: seedCollections,
        }),
    }),
    {
      name: "loco-for-cocoa-react-v2",
      version: 4,
      migrate: (persisted) => {
        const state = persisted as Partial<RecipeStore>;
        return {
          ...state,
          recipes: state.recipes || seedRecipes,
          favorites: state.favorites || [],
          revisions: state.revisions || {},
          collections: state.collections || seedCollections,
        };
      },
    },
  ),
);
