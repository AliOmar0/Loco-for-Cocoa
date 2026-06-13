import { ArrowUpRight, Clock3, Layers3 } from "lucide-react";
import type { Recipe, RecipeCollection } from "../types";
import { RecipeImage } from "./RecipeImage";

type CuratedShelvesProps = {
  recipes: Recipe[];
  collections: RecipeCollection[];
  onOpenRecipe: (recipe: Recipe) => void;
};

export function CuratedShelves({
  recipes,
  collections,
  onOpenRecipe,
}: CuratedShelvesProps) {
  const published = recipes.filter((recipe) => recipe.published);
  const recipeMap = new Map(published.map((recipe) => [recipe.id, recipe]));

  return (
    <section className="curated-shelves section-shell" aria-labelledby="collections-title">
      <div className="collection-heading">
        <div>
          <span className="section-index">02 / Curated shortcuts</span>
          <h2 id="collections-title">
            Choose your <em>energy.</em>
          </h2>
        </div>
        <p>
          Four faster ways into the archive, organized around the decision you
          are actually trying to make.
        </p>
      </div>

      <div className="collection-grid">
        {collections.filter((collection) => collection.enabled).map((collection) => {
          const matches = collection.recipeIds
            .map((id) => recipeMap.get(id))
            .filter((recipe): recipe is Recipe => Boolean(recipe));
          const recipe = matches[0] || published[0];
          if (!recipe) return null;
          return (
            <button
              key={collection.id}
              className={`collection-card collection-${collection.id}`}
              onClick={() => onOpenRecipe(recipe)}
              style={{ "--collection-accent": collection.accent } as React.CSSProperties}
            >
              <RecipeImage recipe={recipe} alt="" loading="lazy" sizes="(max-width: 620px) 78vw, 25vw" />
              <span className="collection-shade" />
              <span className="collection-count">
                <Layers3 size={14} />
                {Math.max(matches.length, 1)} pick{matches.length === 1 ? "" : "s"}
              </span>
              <span className="collection-copy">
                <small>{collection.note}</small>
                <strong>{collection.label}</strong>
                <em>
                  {recipe.title}
                  <ArrowUpRight size={16} />
                </em>
              </span>
              <span className="collection-time">
                <Clock3 size={13} />
                {recipe.time} min
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
