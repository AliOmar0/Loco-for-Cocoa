import { ArrowUpRight, Camera, Check, Star } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CommandPalette } from "../components/CommandPalette";
import { CuratedShelves } from "../components/CuratedShelves";
import { FlavorLab } from "../components/FlavorLab";
import { FieldNotes } from "../components/FieldNotes";
import { Hero } from "../components/Hero";
import { PantryMatcher } from "../components/PantryMatcher";
import { RecipeExplorer } from "../components/RecipeExplorer";
import { RecipeHistoryRails } from "../components/RecipeHistoryRails";
import { SiteHeader } from "../components/SiteHeader";
import { setRecipeSaved } from "../lib/backend";
import { useExperienceStore } from "../store/useExperienceStore";
import { useRecipeStore } from "../store/useRecipeStore";
import type { Recipe } from "../types";

export function HomePage() {
  const recipes = useRecipeStore((state) => state.recipes);
  const collections = useRecipeStore((state) => state.collections);
  const favorites = useRecipeStore((state) => state.favorites);
  const setFavorite = useRecipeStore((state) => state.setFavorite);
  const setRecipeSaveCount = useRecipeStore(
    (state) => state.setRecipeSaveCount,
  );
  const recentlyViewed = useExperienceStore((state) => state.recentlyViewed);
  const bakeSessions = useExperienceStore((state) => state.bakeSessions);
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [transitioningRecipeId, setTransitioningRecipeId] = useState<string | null>(
    null,
  );

  const published = useMemo(
    () => recipes.filter((recipe) => recipe.published),
    [recipes],
  );

  const openRecipe = useCallback((recipe: Recipe) => {
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => {
        ready?: Promise<void>;
        updateCallbackDone?: Promise<void>;
        finished: Promise<void>;
      };
    };

    flushSync(() => setTransitioningRecipeId(recipe.id));
    if (!transitionDocument.startViewTransition) {
      navigate(`/recipes/${encodeURIComponent(recipe.id)}`);
      return;
    }

    try {
      const transition = transitionDocument.startViewTransition(() => {
        flushSync(() => navigate(`/recipes/${encodeURIComponent(recipe.id)}`));
      });
      transition.ready?.catch(() => undefined);
      transition.updateCallbackDone?.catch(() => undefined);
      transition.finished
        .catch(() => undefined)
        .finally(() => setTransitioningRecipeId(null));
    } catch {
      navigate(`/recipes/${encodeURIComponent(recipe.id)}`);
      setTransitioningRecipeId(null);
    }
  }, [navigate]);

  const roulette = useCallback(() => {
    const recipe = published[Math.floor(Math.random() * published.length)];
    if (recipe) openRecipe(recipe);
  }, [openRecipe, published]);

  const toggleFavorite = useCallback(
    (recipeId: string) => {
      const wasSaved = favorites.includes(recipeId);
      const nextSaved = !wasSaved;
      setFavorite(recipeId, nextSaved);
      setRecipeSaved(recipeId, nextSaved)
        .then((result) => {
          if (result.saves >= 0) setRecipeSaveCount(recipeId, result.saves);
        })
        .catch((error) => {
          setFavorite(recipeId, wasSaved);
          console.error("Unable to update recipe save:", error);
        });
    },
    [favorites, setFavorite, setRecipeSaveCount],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="home-page">
      <SiteHeader
        favoritesCount={favorites.length}
        onOpenSearch={() => setSearchOpen(true)}
        onShowFavorites={() => {
          setFavoritesOnly(true);
          document.querySelector("#recipes")?.scrollIntoView({ behavior: "smooth" });
        }}
      />
      <main>
        <Hero
          recipes={published}
          onRoulette={roulette}
          onOpenRecipe={openRecipe}
          transitioningRecipeId={transitioningRecipeId}
        />

        <div className="kinetic-strip" aria-hidden="true">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
          >
            {[...Array(2)].flatMap((_, group) =>
              [
                "gooey centers",
                "soft launches",
                "no secret ingredients",
                "tiny triumphs",
                "whipped cream energy",
              ].map((label) => (
                <span key={`${group}-${label}`}>
                  {label}
                  <Star size={11} fill="currentColor" />
                </span>
              )),
            )}
          </motion.div>
        </div>

        <RecipeExplorer
          recipes={recipes}
          favorites={favorites}
          favoritesOnly={favoritesOnly}
          onFavoritesOnlyChange={setFavoritesOnly}
          onOpenRecipe={openRecipe}
          onToggleFavorite={toggleFavorite}
          transitioningRecipeId={transitioningRecipeId}
        />

        <RecipeHistoryRails
          recipes={recipes}
          recentlyViewed={recentlyViewed}
          bakeSessions={bakeSessions}
          onOpenRecipe={openRecipe}
        />

        <CuratedShelves
          recipes={recipes}
          collections={collections}
          onOpenRecipe={openRecipe}
        />

        <PantryMatcher recipes={recipes} onOpenRecipe={openRecipe} />

        <FlavorLab recipes={recipes} onOpenRecipe={openRecipe} />

        <FieldNotes />

        <section className="newsletter section-shell">
          <div>
            <span className="section-index">Fresh from the oven</span>
            <h2>
              One beautiful recipe.
              <br />
              Every other Sunday.
            </h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.currentTarget.reset();
              setSubscribed(true);
            }}
          >
            {subscribed ? (
              <div className="newsletter-success" role="status">
                <span>
                  <Check size={18} />
                </span>
                <div>
                  <strong>Your slice is saved.</strong>
                  <small>The next recipe will land on a Sunday.</small>
                </div>
              </div>
            ) : (
              <>
                <label>
                  <span>Email address</span>
                  <input type="email" placeholder="you@something.cool" required />
                </label>
                <button className="primary-button">
                  Save me a slice
                  <ArrowUpRight size={18} />
                </button>
              </>
            )}
          </form>
        </section>
      </main>

      <footer className="site-footer">
        <div className="footer-wordmark">
          <span>Loco</span>
          <em>for</em>
          <span>Cocoa</span>
        </div>
        <div className="footer-meta">
          <p>Sweet things, deeply considered.</p>
          <nav>
            <a href="#recipes">Recipes</a>
            <a href="#collections">Collections</a>
            <a href="#pantry">Pantry matcher</a>
            <a href="#flavor-lab">Flavor lab</a>
            <a href="#field-notes">Field notes</a>
          </nav>
          <div>
            <a href="#top" aria-label="Back to top">
              <Camera size={17} />
            </a>
            <span>© {new Date().getFullYear()} Loco for Cocoa</span>
          </div>
        </div>
      </footer>

      <CommandPalette
        open={searchOpen}
        recipes={recipes}
        onClose={() => setSearchOpen(false)}
        onSelect={openRecipe}
      />
    </div>
  );
}
