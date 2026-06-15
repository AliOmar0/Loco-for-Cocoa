import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DistractionLoader } from "../components/DistractionLoader";
import { RecipeDetail } from "../components/RecipeDetail";
import {
  getRecipeTranslation,
  recordRecipeView,
  setRecipeSaved,
} from "../lib/backend";
import { useExperienceStore } from "../store/useExperienceStore";
import { useRecipeStore } from "../store/useRecipeStore";
import { NotFoundPage } from "./NotFoundPage";
import type { RecipeTranslation } from "../types";

type RecipePageProps = {
  archiveReady: boolean;
};

export function RecipePage({ archiveReady }: RecipePageProps) {
  const { recipeId = "" } = useParams();
  const navigate = useNavigate();
  const recordedRecipe = useRef<string | null>(null);
  const recipes = useRecipeStore((state) => state.recipes);
  const favorites = useRecipeStore((state) => state.favorites);
  const setFavorite = useRecipeStore((state) => state.setFavorite);
  const setRecipeSaveCount = useRecipeStore(
    (state) => state.setRecipeSaveCount,
  );
  const recordView = useExperienceStore((state) => state.recordView);
  const [language, setLanguage] = useState<"en" | "ar">(() =>
    localStorage.getItem("loco-recipe-language") === "ar" ? "ar" : "en",
  );
  const [translation, setTranslation] =
    useState<RecipeTranslation | null>(null);
  const [translationLoading, setTranslationLoading] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const recipe = recipes.find(
    (item) => item.id === recipeId && item.published,
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [recipeId]);

  useEffect(() => {
    if (!recipe || recordedRecipe.current === recipe.id) return;
    recordedRecipe.current = recipe.id;
    recordView(recipe.id);
    recordRecipeView(recipe.id).catch((error) => {
      console.error("Unable to record recipe view:", error);
    });
  }, [recipe, recordView]);

  useEffect(() => {
    setTranslation(null);
    setTranslationError("");
  }, [recipeId]);

  if (!archiveReady && !recipe) {
    return <DistractionLoader label="Finding that recipe in the archive..." />;
  }

  if (!recipe) return <NotFoundPage />;

  const changeLanguage = async (nextLanguage: "en" | "ar") => {
    setLanguage(nextLanguage);
    localStorage.setItem("loco-recipe-language", nextLanguage);
    setTranslationError("");
    if (nextLanguage === "en" || translation) return;
    setTranslationLoading(true);
    try {
      const result = await getRecipeTranslation(recipe.id, "ar");
      setTranslation(result.translation);
    } catch (error) {
      setLanguage("en");
      localStorage.setItem("loco-recipe-language", "en");
      setTranslationError(
        error instanceof Error
          ? error.message
          : "Arabic translation is unavailable.",
      );
    } finally {
      setTranslationLoading(false);
    }
  };

  const toggleSaved = () => {
    const wasSaved = favorites.includes(recipe.id);
    const nextSaved = !wasSaved;
    setFavorite(recipe.id, nextSaved);
    setRecipeSaved(recipe.id, nextSaved)
      .then((result) => {
        if (result.saves >= 0) setRecipeSaveCount(recipe.id, result.saves);
      })
      .catch((error) => {
        setFavorite(recipe.id, wasSaved);
        console.error("Unable to update recipe save:", error);
      });
  };

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate({ pathname: "/", hash: "#recipes" });
  };

  return (
    <main className="recipe-page">
      <RecipeDetail
        recipe={recipe}
        favorite={favorites.includes(recipe.id)}
        onClose={goBack}
        onToggleFavorite={toggleSaved}
        language={language}
        translation={translation}
        translationLoading={translationLoading}
        translationError={translationError}
        onLanguageChange={changeLanguage}
        sharedName={`recipe-image-${recipe.id}`}
      />
    </main>
  );
}
