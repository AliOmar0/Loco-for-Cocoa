import { ArrowUpRight, Clock3, Layers3 } from "lucide-react";
import type { Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";

type CuratedShelvesProps = {
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
};

const collections = [
  {
    id: "one-bowl",
    label: "One bowl",
    note: "Low cleanup, high reward",
    match: (recipe: Recipe) =>
      /one-bowl|one bowl/i.test(`${recipe.title} ${recipe.description}`),
  },
  {
    id: "no-oven",
    label: "No oven",
    note: "Cool kitchen behavior",
    match: (recipe: Recipe) => recipe.category === "no-bake",
  },
  {
    id: "fifteen",
    label: "15 minutes",
    note: "The craving is urgent",
    match: (recipe: Recipe) => recipe.time <= 15,
  },
  {
    id: "weekend",
    label: "Weekend project",
    note: "Make an afternoon of it",
    match: (recipe: Recipe) =>
      recipe.difficulty === "Project" || recipe.time >= 60,
  },
] as const;

export function CuratedShelves({
  recipes,
  onOpenRecipe,
}: CuratedShelvesProps) {
  const published = recipes.filter((recipe) => recipe.published);

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
        {collections.map((collection) => {
          const matches = published.filter(collection.match);
          const recipe = matches[0] || published[0];
          if (!recipe) return null;
          return (
            <button
              key={collection.id}
              className={`collection-card collection-${collection.id}`}
              onClick={() => onOpenRecipe(recipe)}
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
