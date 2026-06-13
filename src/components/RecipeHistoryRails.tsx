import { ArrowUpRight, Clock3, Play } from "lucide-react";
import type { BakeSession, Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";

type RecipeHistoryRailsProps = {
  recipes: Recipe[];
  recentlyViewed: string[];
  bakeSessions: Record<string, BakeSession>;
  onOpenRecipe: (recipe: Recipe) => void;
};

function MiniRail({
  title,
  eyebrow,
  recipes,
  sessions,
  onOpenRecipe,
}: {
  title: string;
  eyebrow: string;
  recipes: Recipe[];
  sessions?: Record<string, BakeSession>;
  onOpenRecipe: (recipe: Recipe) => void;
}) {
  if (!recipes.length) return null;
  return (
    <section className="history-rail">
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <small>Stored on this device</small>
      </header>
      <div>
        {recipes.map((recipe) => {
          const session = sessions?.[recipe.id];
          const progress = session
            ? Math.round((session.completed.length / recipe.steps.length) * 100)
            : 0;
          return (
            <button key={recipe.id} onClick={() => onOpenRecipe(recipe)}>
              <RecipeImage recipe={recipe} alt="" loading="lazy" sizes="240px" />
              <span className="history-card-shade" />
              <span className="history-card-copy">
                <small>
                  {session ? (
                    <>
                      <Play size={12} fill="currentColor" />
                      {progress}% baked
                    </>
                  ) : (
                    <>
                      <Clock3 size={12} />
                      {recipe.time} min
                    </>
                  )}
                </small>
                <strong>{recipe.title}</strong>
                <em>
                  {session ? `Resume at step ${session.activeStep + 1}` : "Open again"}
                  <ArrowUpRight size={15} />
                </em>
              </span>
              {session && (
                <i style={{ "--history-progress": `${progress}%` } as React.CSSProperties} />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function RecipeHistoryRails({
  recipes,
  recentlyViewed,
  bakeSessions,
  onOpenRecipe,
}: RecipeHistoryRailsProps) {
  const byId = new Map(recipes.map((recipe) => [recipe.id, recipe]));
  const recent = recentlyViewed
    .map((id) => byId.get(id))
    .filter((recipe): recipe is Recipe => Boolean(recipe?.published))
    .slice(0, 4);
  const continuing = Object.values(bakeSessions)
    .filter((session) => {
      const recipe = byId.get(session.recipeId);
      const hasProgress =
        session.bakeMode ||
        session.activeStep > 0 ||
        session.completed.length > 0 ||
        session.checkedIngredients.length > 0 ||
        Object.keys(session.timers).length > 0;
      return (
        recipe?.published &&
        hasProgress &&
        session.completed.length < recipe.steps.length
      );
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((session) => byId.get(session.recipeId))
    .filter((recipe): recipe is Recipe => Boolean(recipe))
    .slice(0, 4);

  if (!recent.length && !continuing.length) return null;

  return (
    <div className="recipe-history-shell section-shell">
      <MiniRail
        eyebrow="Your kitchen memory"
        title="Continue baking."
        recipes={continuing}
        sessions={bakeSessions}
        onOpenRecipe={onOpenRecipe}
      />
      <MiniRail
        eyebrow="One more look"
        title="Recently viewed."
        recipes={recent}
        onOpenRecipe={onOpenRecipe}
      />
    </div>
  );
}
