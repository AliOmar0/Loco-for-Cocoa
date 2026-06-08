import {
  ArrowLeft,
  Check,
  ChefHat,
  Clock3,
  Copy,
  Heart,
  Minus,
  Plus,
  Printer,
  Share2,
  TimerReset,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { formatTime, moodLabels, scaleIngredient } from "../lib/recipe";
import type { Recipe, RecipeStep } from "../types";

type RecipeDetailProps = {
  recipe: Recipe | null;
  favorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
};

function StepTimer({ step }: { step: RecipeStep }) {
  const total = (step.duration || 0) * 60;
  const [remaining, setRemaining] = useState(total);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = window.setInterval(
      () => setRemaining((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [remaining, running]);

  if (!step.duration) return null;

  return (
    <button
      className={`step-timer ${running ? "is-running" : ""}`}
      onClick={() => {
        if (remaining === 0) setRemaining(total);
        setRunning((value) => !value);
      }}
    >
      <TimerReset size={14} />
      {running || remaining !== total ? formatTime(remaining) : `${step.duration} min timer`}
    </button>
  );
}

export function RecipeDetail({
  recipe,
  favorite,
  onClose,
  onToggleFavorite,
}: RecipeDetailProps) {
  const [servings, setServings] = useState(recipe?.servings || 1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!recipe) return;
    setServings(recipe.servings);
    setCompleted([]);
  }, [recipe]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(
    () => () => {
      wakeLock?.release().catch(() => undefined);
    },
    [wakeLock],
  );

  const progress = useMemo(() => {
    if (!recipe?.steps.length) return 0;
    return Math.round((completed.length / recipe.steps.length) * 100);
  }, [completed.length, recipe?.steps.length]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {recipe && (
        <motion.div
          className="recipe-detail-layer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button className="detail-backdrop" onClick={onClose} aria-label="Close recipe" />
          <motion.article
            className="recipe-detail"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 34, stiffness: 260 }}
          >
            <div className="detail-rail">
              <button onClick={onClose} aria-label="Close recipe">
                <ArrowLeft size={19} />
              </button>
              <span>Recipe / {recipe.id}</span>
              <button onClick={onClose} aria-label="Close recipe">
                <X size={19} />
              </button>
            </div>

            <div className="detail-hero">
              <img
                src={recipe.image}
                alt={recipe.title}
                onError={(event) => {
                  event.currentTarget.src = "/assets/dessert-hero.png";
                }}
              />
              <div
                className="detail-gradient"
                style={{
                  background: `linear-gradient(145deg, ${recipe.accent[0]}33, ${recipe.accent[1]}77)`,
                }}
              />
              <div className="detail-title">
                <span>{moodLabels[recipe.mood]} energy</span>
                <h2>{recipe.title}</h2>
                <p>{recipe.description}</p>
              </div>
              <div className="detail-score">
                <strong>{recipe.rating}</strong>
                <span>community score</span>
              </div>
            </div>

            <div className="detail-content">
              <aside className="ingredient-panel">
                <div className="detail-meta-grid">
                  <div>
                    <Clock3 size={16} />
                    <span>Time</span>
                    <strong>{recipe.time} min</strong>
                  </div>
                  <div>
                    <ChefHat size={16} />
                    <span>Level</span>
                    <strong>{recipe.difficulty}</strong>
                  </div>
                  <div>
                    <Zap size={16} />
                    <span>Steps</span>
                    <strong>{recipe.steps.length}</strong>
                  </div>
                </div>

                <div className="serving-control">
                  <div>
                    <span>Servings</span>
                    <strong>{servings} sweet people</strong>
                  </div>
                  <div>
                    <button
                      onClick={() => setServings((value) => Math.max(1, value - 1))}
                      aria-label="Decrease servings"
                    >
                      <Minus size={15} />
                    </button>
                    <span>{servings}</span>
                    <button
                      onClick={() => setServings((value) => value + 1)}
                      aria-label="Increase servings"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                <h3>What you need</h3>
                <ul className="ingredient-list">
                  {recipe.ingredients.map((ingredient) => (
                    <li key={ingredient}>
                      {scaleIngredient(ingredient, servings / recipe.servings)}
                    </li>
                  ))}
                </ul>

                <div className="detail-action-grid">
                  <button
                    className={favorite ? "is-active" : ""}
                    onClick={onToggleFavorite}
                  >
                    <Heart size={16} fill={favorite ? "currentColor" : "none"} />
                    {favorite ? "Saved" : "Save"}
                  </button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard?.writeText(window.location.href);
                    }}
                  >
                    <Share2 size={16} />
                    Share
                  </button>
                  <button onClick={() => window.print()}>
                    <Printer size={16} />
                    Print
                  </button>
                  <button
                    className={wakeLock ? "is-active" : ""}
                    onClick={async () => {
                      if (wakeLock) {
                        await wakeLock.release();
                        setWakeLock(null);
                      } else if ("wakeLock" in navigator) {
                        const lock = await navigator.wakeLock.request("screen");
                        setWakeLock(lock);
                      }
                    }}
                  >
                    <Zap size={16} />
                    {wakeLock ? "Awake" : "Bake mode"}
                  </button>
                </div>
              </aside>

              <section className="method-panel">
                <div className="method-heading">
                  <div>
                    <span>The method</span>
                    <h3>Make it happen.</h3>
                  </div>
                  <div className="method-progress" style={{ "--progress": `${progress}%` } as React.CSSProperties}>
                    <strong>{progress}%</strong>
                    <span>complete</span>
                  </div>
                </div>

                <ol className="method-list">
                  {recipe.steps.map((step, index) => {
                    const isComplete = completed.includes(index);
                    return (
                      <li key={`${step.text}-${index}`} className={isComplete ? "is-complete" : ""}>
                        <button
                          className="step-check"
                          onClick={() =>
                            setCompleted((values) =>
                              values.includes(index)
                                ? values.filter((value) => value !== index)
                                : [...values, index],
                            )
                          }
                          aria-label={`Mark step ${index + 1} ${isComplete ? "incomplete" : "complete"}`}
                        >
                          {isComplete ? <Check size={17} /> : String(index + 1).padStart(2, "0")}
                        </button>
                        <div>
                          <p>{step.text}</p>
                          <StepTimer step={step} />
                        </div>
                      </li>
                    );
                  })}
                </ol>

                <div className="bakers-note">
                  <span>Baker's note</span>
                  <p>{recipe.notes}</p>
                  <button
                    onClick={() => navigator.clipboard?.writeText(recipe.notes)}
                    aria-label="Copy baker's note"
                  >
                    <Copy size={15} />
                  </button>
                </div>
              </section>
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
