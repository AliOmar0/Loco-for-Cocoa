import { AnimatePresence, motion } from "motion/react";
import { Grid2X2, Heart, Rows3, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { categoryLabels, moodLabels } from "../lib/recipe";
import type { Recipe, RecipeCategory, RecipeMood } from "../types";
import { RecipeCard } from "./RecipeCard";

type RecipeExplorerProps = {
  recipes: Recipe[];
  favorites: string[];
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onToggleFavorite: (id: string) => void;
  transitioningRecipeId?: string | null;
  selectedRecipeId?: string | null;
};

export function RecipeExplorer({
  recipes,
  favorites,
  favoritesOnly,
  onFavoritesOnlyChange,
  onOpenRecipe,
  onToggleFavorite,
  transitioningRecipeId,
  selectedRecipeId,
}: RecipeExplorerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<RecipeCategory | "all">("all");
  const [mood, setMood] = useState<RecipeMood | "all">("all");
  const [compact, setCompact] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return recipes
      .filter((recipe) => recipe.published)
      .filter((recipe) => category === "all" || recipe.category === category)
      .filter((recipe) => mood === "all" || recipe.mood === mood)
      .filter((recipe) => !favoritesOnly || favorites.includes(recipe.id))
      .filter((recipe) => {
        if (!normalized) return true;
        return [
          recipe.title,
          recipe.subtitle,
          recipe.description,
          ...recipe.ingredients,
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      })
      .sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [category, favorites, favoritesOnly, mood, query, recipes]);

  const reset = () => {
    setQuery("");
    setCategory("all");
    setMood("all");
    onFavoritesOnlyChange(false);
  };

  return (
    <section className="recipe-explorer section-shell" id="recipes">
      <div className="section-intro">
        <div>
          <span className="section-index">01 / The archive</span>
          <h2>
            Pick your <em>plot.</em>
          </h2>
        </div>
        <p>
          Every recipe has been tested in a real kitchen, with real dishes and
          absolutely no mysterious “just know when it is done” energy.
        </p>
      </div>

      <div className="explorer-toolbar">
        <label className="archive-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a craving, ingredient, or mood"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </label>

        <div className="toolbar-actions">
          <button
            className={`tool-button ${filtersOpen ? "is-active" : ""}`}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
          <button
            className={`tool-button ${favoritesOnly ? "is-active" : ""}`}
            onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
          >
            <Heart size={16} fill={favoritesOnly ? "currentColor" : "none"} />
            Saved
          </button>
          <div className="layout-switch">
            <button
              className={!compact ? "is-active" : ""}
              onClick={() => setCompact(false)}
              aria-label="Editorial grid"
            >
              <Grid2X2 size={16} />
            </button>
            <button
              className={compact ? "is-active" : ""}
              onClick={() => setCompact(true)}
              aria-label="Compact grid"
            >
              <Rows3 size={16} />
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            className="filter-drawer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div>
              <span>Format</span>
              <div className="filter-pills">
                <button
                  className={category === "all" ? "is-active" : ""}
                  onClick={() => setCategory("all")}
                >
                  Everything
                </button>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <button
                    key={value}
                    className={category === value ? "is-active" : ""}
                    onClick={() => setCategory(value as RecipeCategory)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span>Energy</span>
              <div className="filter-pills">
                <button
                  className={mood === "all" ? "is-active" : ""}
                  onClick={() => setMood("all")}
                >
                  Any mood
                </button>
                {Object.entries(moodLabels).map(([value, label]) => (
                  <button
                    key={value}
                    className={mood === value ? "is-active" : ""}
                    onClick={() => setMood(value as RecipeMood)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="archive-status">
        <span>
          Showing <strong>{filtered.length}</strong> sweet things
        </span>
        {(query || category !== "all" || mood !== "all" || favoritesOnly) && (
          <button onClick={reset}>Clear the counter</button>
        )}
      </div>

      <motion.div layout className={`recipe-grid ${compact ? "is-compact" : ""}`}>
        <AnimatePresence mode="popLayout">
          {filtered.map((recipe, index) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              index={index}
              favorite={favorites.includes(recipe.id)}
              onOpen={() => onOpenRecipe(recipe)}
              onFavorite={() => onToggleFavorite(recipe.id)}
              sharedName={
                transitioningRecipeId === recipe.id &&
                selectedRecipeId !== recipe.id
                  ? `recipe-image-${recipe.id}`
                  : undefined
              }
            />
          ))}
        </AnimatePresence>
      </motion.div>

      {filtered.length === 0 && (
        <div className="archive-empty">
          <span>0 crumbs found</span>
          <h3>That craving is being mysterious.</h3>
          <p>Try a wider search, or reset the filters and let the archive surprise you.</p>
          <button className="primary-button" onClick={reset}>
            Reset archive
          </button>
        </div>
      )}
    </section>
  );
}
