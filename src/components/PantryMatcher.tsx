import { ArrowUpRight, Check, Plus, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ingredientKeywords } from "../lib/recipe";
import type { Recipe } from "../types";
import { RecipeImage } from "./RecipeImage";

type PantryMatcherProps = {
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
};

const pantryPicks = [
  "chocolate",
  "cocoa",
  "butter",
  "eggs",
  "flour",
  "cream",
  "milk",
  "coffee",
  "cinnamon",
  "strawberry",
];

function normalizeTerm(value: string) {
  return value.toLowerCase().trim().replace(/s$/, "");
}

export function PantryMatcher({ recipes, onOpenRecipe }: PantryMatcherProps) {
  const [selected, setSelected] = useState<string[]>(["butter", "eggs", "flour"]);
  const [custom, setCustom] = useState("");

  const ranked = useMemo(() => {
    const terms = selected.map(normalizeTerm);
    return recipes
      .filter((recipe) => recipe.published)
      .map((recipe) => {
        const keywords = ingredientKeywords(recipe);
        const matched = terms.filter((term) =>
          keywords.some((keyword) => normalizeTerm(keyword).includes(term)),
        );
        const missing = keywords
          .filter(
            (keyword) =>
              !terms.some((term) => normalizeTerm(keyword).includes(term)),
          )
          .slice(0, 3);
        return { recipe, matched, missing };
      })
      .sort(
        (a, b) =>
          b.matched.length - a.matched.length ||
          a.recipe.time - b.recipe.time,
      )
      .slice(0, 3);
  }, [recipes, selected]);

  const toggle = (term: string) => {
    const normalized = normalizeTerm(term);
    if (!normalized) return;
    setSelected((current) =>
      current.some((item) => normalizeTerm(item) === normalized)
        ? current.filter((item) => normalizeTerm(item) !== normalized)
        : [...current, term.trim()],
    );
  };

  return (
    <section className="pantry-matcher section-shell" id="pantry">
      <div className="pantry-intro">
        <span className="section-index">03 / Pantry matcher</span>
        <h2>
          Bake with what is <em>already there.</em>
        </h2>
        <p>
          Tap what is in your kitchen. The matcher ranks recipes by ingredient
          overlap, then favors the quickest tie.
        </p>
      </div>

      <div className="pantry-workbench">
        <div className="pantry-controls">
          <div className="pantry-label">
            <Sparkles size={16} />
            <span>Your shelf</span>
            <strong>{selected.length} ingredients</strong>
          </div>
          <div className="pantry-chips">
            {pantryPicks.map((term) => {
              const active = selected.some(
                (item) => normalizeTerm(item) === normalizeTerm(term),
              );
              return (
                <button
                  key={term}
                  className={active ? "is-active" : ""}
                  onClick={() => toggle(term)}
                >
                  {active ? <Check size={13} /> : <Plus size={13} />}
                  {term}
                </button>
              );
            })}
          </div>
          <form
            className="pantry-add"
            onSubmit={(event) => {
              event.preventDefault();
              if (custom.trim()) toggle(custom);
              setCustom("");
            }}
          >
            <Search size={16} />
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              placeholder="Add mascarpone, brioche..."
            />
            <button aria-label="Add pantry ingredient">
              <Plus size={16} />
            </button>
          </form>
          {selected.length > 0 && (
            <div className="selected-pantry">
              {selected.map((term) => (
                <button key={term} onClick={() => toggle(term)}>
                  {term}
                  <X size={12} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="pantry-results" aria-live="polite">
          {ranked.map(({ recipe, matched, missing }, index) => (
            <button key={recipe.id} onClick={() => onOpenRecipe(recipe)}>
              <RecipeImage recipe={recipe} alt="" loading="lazy" sizes="180px" />
              <span className="pantry-rank">0{index + 1}</span>
              <span className="pantry-result-copy">
                <small>
                  {matched.length} of {selected.length || 1} pantry picks match
                </small>
                <strong>{recipe.title}</strong>
                <em>
                  {missing.length
                    ? `You may still need ${missing.join(", ")}`
                    : "Your pantry is ready"}
                </em>
              </span>
              <ArrowUpRight size={18} />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
