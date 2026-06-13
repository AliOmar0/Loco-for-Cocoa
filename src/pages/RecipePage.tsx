import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { DistractionLoader } from "../components/DistractionLoader";
import { RecipeDetail } from "../components/RecipeDetail";
import { recordRecipeView } from "../lib/backend";
import { useExperienceStore } from "../store/useExperienceStore";
import { useRecipeStore } from "../store/useRecipeStore";
import { NotFoundPage } from "./NotFoundPage";

type RecipePageProps = {
  archiveReady: boolean;
};

export function RecipePage({ archiveReady }: RecipePageProps) {
  const { recipeId = "" } = useParams();
  const navigate = useNavigate();
  const recordedRecipe = useRef<string | null>(null);
  const recipes = useRecipeStore((state) => state.recipes);
  const favorites = useRecipeStore((state) => state.favorites);
  const toggleFavorite = useRecipeStore((state) => state.toggleFavorite);
  const recordView = useExperienceStore((state) => state.recordView);
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

  if (!archiveReady && !recipe) {
    return <DistractionLoader label="Finding that recipe in the archive..." />;
  }

  if (!recipe) return <NotFoundPage />;

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
        onToggleFavorite={() => toggleFavorite(recipe.id)}
        sharedName={`recipe-image-${recipe.id}`}
      />
    </main>
  );
}
