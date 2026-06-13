import { ArrowUpRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { dessertHeroImage } from "../lib/assets";
import { recipeScore } from "../lib/recipe";
import type { Recipe } from "../types";

type FlavorLabProps = {
  recipes: Recipe[];
  onOpenRecipe: (recipe: Recipe) => void;
};

export function FlavorLab({ recipes, onOpenRecipe }: FlavorLabProps) {
  const [values, setValues] = useState({ rich: 72, effort: 38, playful: 64 });
  const recommendation = useMemo(
    () =>
      [...recipes]
        .filter((recipe) => recipe.published)
        .sort((a, b) => recipeScore(a, values) - recipeScore(b, values))[0],
    [recipes, values],
  );

  useEffect(() => {
    if (!recommendation) return;
    window.dispatchEvent(
      new CustomEvent("loco:shader-palette", {
        detail: {
          primary: recommendation.accent[0],
          secondary: recommendation.accent[1],
          texture: values.playful / 100,
        },
      }),
    );
  }, [recommendation, values.playful]);

  if (!recommendation) return null;

  return (
    <section className="flavor-lab section-shell" id="flavor-lab">
      <div className="lab-copy">
        <span className="section-index">02 / Flavor lab</span>
        <h2>
          Tune your <em>craving.</em>
        </h2>
        <p>
          Slide until the emotional weather feels accurate. The archive will
          find your closest dessert match in real time.
        </p>

        <div className="flavor-controls">
          {[
            ["rich", "Chocolate gravity", "whisper", "full drama"],
            ["effort", "Kitchen ambition", "ten minutes", "make a day of it"],
            ["playful", "Camera energy", "quietly good", "main feed"],
          ].map(([key, label, low, high]) => (
            <label key={key}>
              <div>
                <strong>{label}</strong>
                <span>{values[key as keyof typeof values]}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={values[key as keyof typeof values]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [key]: Number(event.target.value),
                  }))
                }
              />
              <small>
                <span>{low}</span>
                <span>{high}</span>
              </small>
            </label>
          ))}
        </div>
      </div>

      <motion.button
        layout
        className="lab-result"
        onClick={() => onOpenRecipe(recommendation)}
        whileHover={{ y: -8, rotate: -0.5 }}
      >
        <img
          src={recommendation.image}
          alt=""
          onError={(event) => {
            event.currentTarget.src = dessertHeroImage;
          }}
        />
        <div
          className="lab-result-tint"
          style={{
            background: `linear-gradient(135deg, ${recommendation.accent[0]}33, ${recommendation.accent[1]}88)`,
          }}
        />
        <span className="lab-stamp">
          <Sparkles size={16} />
          your current frequency
        </span>
        <div className="lab-result-copy">
          <span>Closest match</span>
          <h3>{recommendation.title}</h3>
          <p>{recommendation.subtitle}</p>
          <i>
            Open recipe
            <ArrowUpRight size={17} />
          </i>
        </div>
      </motion.button>
    </section>
  );
}
