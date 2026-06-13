import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  BakeSession,
  BakeTimerState,
  ComfortPreferences,
} from "../types";

const defaultComfort: ComfortPreferences = {
  fontScale: "default",
  contrast: "default",
  reducedIntensity: false,
  sounds: true,
  cursorEffects: true,
};

type ExperienceStore = {
  bakeSessions: Record<string, BakeSession>;
  recentlyViewed: string[];
  comfort: ComfortPreferences;
  recordView: (recipeId: string) => void;
  updateBakeSession: (
    recipeId: string,
    patch: Partial<Omit<BakeSession, "recipeId" | "updatedAt">>,
  ) => void;
  updateTimer: (
    recipeId: string,
    stepIndex: number,
    timer: BakeTimerState,
  ) => void;
  clearBakeSession: (recipeId: string) => void;
  updateComfort: (patch: Partial<ComfortPreferences>) => void;
};

export const useExperienceStore = create<ExperienceStore>()(
  persist(
    (set) => ({
      bakeSessions: {},
      recentlyViewed: [],
      comfort: defaultComfort,
      recordView: (recipeId) =>
        set((state) => ({
          recentlyViewed: [
            recipeId,
            ...state.recentlyViewed.filter((id) => id !== recipeId),
          ].slice(0, 8),
        })),
      updateBakeSession: (recipeId, patch) =>
        set((state) => {
          const current = state.bakeSessions[recipeId];
          const next: BakeSession = current
            ? {
                ...current,
                ...patch,
                updatedAt: new Date().toISOString(),
              }
            : {
                recipeId,
                completed: [],
                checkedIngredients: [],
                activeStep: 0,
                servings: 1,
                realisticPortions: false,
                bakeMode: false,
                timers: {},
                ...patch,
                updatedAt: new Date().toISOString(),
              };
          return {
            bakeSessions: {
              ...state.bakeSessions,
              [recipeId]: next,
            },
          };
        }),
      updateTimer: (recipeId, stepIndex, timer) =>
        set((state) => {
          const current = state.bakeSessions[recipeId];
          if (!current) return state;
          return {
            bakeSessions: {
              ...state.bakeSessions,
              [recipeId]: {
                ...current,
                timers: { ...current.timers, [stepIndex]: timer },
                updatedAt: new Date().toISOString(),
              },
            },
          };
        }),
      clearBakeSession: (recipeId) =>
        set((state) => ({
          bakeSessions: Object.fromEntries(
            Object.entries(state.bakeSessions).filter(([id]) => id !== recipeId),
          ),
        })),
      updateComfort: (patch) =>
        set((state) => ({
          comfort: { ...state.comfort, ...patch },
        })),
    }),
    {
      name: "loco-for-cocoa-experience-v1",
      version: 1,
    },
  ),
);
