import { ArrowRight, Clock3, Search, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { dessertHeroImage } from "../lib/assets";
import type { Recipe } from "../types";

type CommandPaletteProps = {
  open: boolean;
  recipes: Recipe[];
  onClose: () => void;
  onSelect: (recipe: Recipe) => void;
};

export function CommandPalette({
  open,
  recipes,
  onClose,
  onSelect,
}: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const normalized = query.toLowerCase();
    return recipes
      .filter((recipe) => recipe.published)
      .filter((recipe) =>
        [recipe.title, recipe.subtitle, recipe.description, ...recipe.ingredients]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
      .slice(0, 6);
  }, [query, recipes]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="command-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="command-backdrop" onClick={onClose} aria-label="Close search" />
          <motion.div
            className="command-palette"
            initial={{ opacity: 0, scale: 0.96, y: -18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -10 }}
          >
            <label>
              <Search size={20} />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the sweet archive..."
              />
              <button onClick={onClose} aria-label="Close search">
                <X size={18} />
              </button>
            </label>
            <div className="command-results">
              <span>{query ? `${results.length} matches` : "Popular right now"}</span>
              {results.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => {
                    onSelect(recipe);
                    onClose();
                  }}
                >
                  <img
                    src={recipe.image}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = dessertHeroImage;
                    }}
                  />
                  <div>
                    <strong>{recipe.title}</strong>
                    <small>
                      <Clock3 size={12} />
                      {recipe.time} min · {recipe.subtitle}
                    </small>
                  </div>
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
            <footer>
              <span>
                <kbd>esc</kbd> close
              </span>
              <span>
                <kbd>enter</kbd> open
              </span>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
