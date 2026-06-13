import { ArrowUpRight, Clock3, Layers3, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
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
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(
    null,
  );
  const published = recipes.filter((recipe) => recipe.published);
  const recipeMap = new Map(published.map((recipe) => [recipe.id, recipe]));
  const visibleCollections = collections
    .filter((collection) => collection.enabled)
    .map((collection) => ({
      collection,
      recipes: collection.recipeIds
        .map((id) => recipeMap.get(id))
        .filter((recipe): recipe is Recipe => Boolean(recipe)),
    }))
    .filter((entry) => entry.recipes.length > 0);
  const activeCollection = visibleCollections.find(
    (entry) => entry.collection.id === activeCollectionId,
  );

  return (
    <section
      className="curated-shelves section-shell"
      id="collections"
      aria-labelledby="collections-title"
    >
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
        {visibleCollections.map(({ collection, recipes: matches }) => {
          const recipe = matches[0];
          return (
            <button
              key={collection.id}
              className={`collection-card collection-${collection.id} ${
                activeCollectionId === collection.id ? "is-active" : ""
              }`}
              onClick={() =>
                setActiveCollectionId((current) =>
                  current === collection.id ? null : collection.id,
                )
              }
              style={{ "--collection-accent": collection.accent } as React.CSSProperties}
              aria-expanded={activeCollectionId === collection.id}
              aria-controls="collection-recipes"
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
                  View all {matches.length} recipe{matches.length === 1 ? "" : "s"}
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

      <AnimatePresence initial={false}>
        {activeCollection && (
          <motion.div
            id="collection-recipes"
            className="collection-drawer"
            initial={{ opacity: 0, y: 18, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: 8, height: 0 }}
          >
            <div className="collection-drawer-heading">
              <div>
                <span>{activeCollection.collection.note}</span>
                <h3>{activeCollection.collection.label}</h3>
                <p>{activeCollection.collection.description}</p>
              </div>
              <button
                onClick={() => setActiveCollectionId(null)}
                aria-label="Close collection"
              >
                <X size={18} />
              </button>
            </div>
            <div className="collection-recipe-grid">
              {activeCollection.recipes.map((recipe) => (
                <button
                  key={recipe.id}
                  className="collection-recipe-card"
                  onClick={() => onOpenRecipe(recipe)}
                >
                  <span className="collection-recipe-image">
                    <RecipeImage
                      recipe={recipe}
                      alt=""
                      loading="lazy"
                      sizes="(max-width: 620px) 74vw, 24vw"
                    />
                  </span>
                  <span className="collection-recipe-copy">
                    <small>
                      <Clock3 size={13} />
                      {recipe.time} min · {recipe.difficulty}
                    </small>
                    <strong>{recipe.title}</strong>
                    <em>
                      Open recipe
                      <ArrowUpRight size={15} />
                    </em>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
