import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  ChefHat,
  Clock3,
  Copy,
  Heart,
  Minus,
  Plus,
  Play,
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
import { RecipeImage } from "./RecipeImage";

type RecipeDetailProps = {
  recipe: Recipe | null;
  favorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  sharedName?: string;
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
  sharedName,
}: RecipeDetailProps) {
  const [servings, setServings] = useState(recipe?.servings || 1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [checkedIngredients, setCheckedIngredients] = useState<number[]>([]);
  const [bakeMode, setBakeMode] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!recipe) return;
    setServings(recipe.servings);
    setCompleted([]);
    setCheckedIngredients([]);
    setBakeMode(false);
    setActiveStep(0);
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

  const setStep = (index: number) => {
    if (!recipe) return;
    const next = Math.max(0, Math.min(recipe.steps.length - 1, index));
    setActiveStep(next);
    window.setTimeout(() => {
      document
        .querySelector(`[data-method-step="${next}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  };

  const toggleBakeMode = async () => {
    const next = !bakeMode;
    setBakeMode(next);
    if (next && !wakeLock && "wakeLock" in navigator) {
      try {
        setWakeLock(await navigator.wakeLock.request("screen"));
      } catch {
        setWakeLock(null);
      }
    }
    if (!next && wakeLock) {
      await wakeLock.release().catch(() => undefined);
      setWakeLock(null);
    }
  };

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
            className={`recipe-detail ${bakeMode ? "is-bake-mode" : ""}`}
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
              <RecipeImage
                recipe={recipe}
                alt={recipe.title}
                sizes="(max-width: 620px) 100vw, 94vw"
                sharedName={sharedName}
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
                  {recipe.ingredients.map((ingredient, index) => {
                    const checked = checkedIngredients.includes(index);
                    return (
                    <li key={ingredient} className={checked ? "is-checked" : ""}>
                      <button
                        onClick={() =>
                          setCheckedIngredients((values) =>
                            values.includes(index)
                              ? values.filter((value) => value !== index)
                              : [...values, index],
                          )
                        }
                        aria-label={`${checked ? "Uncheck" : "Check"} ${ingredient}`}
                      >
                        <span>{checked && <Check size={13} />}</span>
                        {scaleIngredient(ingredient, servings / recipe.servings)}
                      </button>
                    </li>
                    );
                  })}
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
                    className={bakeMode ? "is-active" : ""}
                    onClick={toggleBakeMode}
                  >
                    <Play size={16} />
                    {bakeMode ? "Exit bake mode" : "Start bake mode"}
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

                {bakeMode && (
                  <div className="bake-focus-card" role="status">
                    <div>
                      <span>
                        Step {activeStep + 1} of {recipe.steps.length}
                      </span>
                      <strong>{recipe.steps[activeStep]?.text}</strong>
                    </div>
                    <StepTimer
                      key={activeStep}
                      step={recipe.steps[activeStep]}
                    />
                  </div>
                )}

                <ol className="method-list">
                  {recipe.steps.map((step, index) => {
                    const isComplete = completed.includes(index);
                    return (
                      <li
                        key={`${step.text}-${index}`}
                        data-method-step={index}
                        className={`${isComplete ? "is-complete" : ""} ${
                          bakeMode && activeStep === index ? "is-active-step" : ""
                        }`}
                        onClick={() => bakeMode && setActiveStep(index)}
                      >
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

            <div className={`bake-mode-bar ${bakeMode ? "is-active" : ""}`}>
              {bakeMode ? (
                <>
                  <button
                    onClick={() => setStep(activeStep - 1)}
                    disabled={activeStep === 0}
                    aria-label="Previous step"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button className="bake-mode-status" onClick={() => setStep(activeStep)}>
                    <span>
                      Step {activeStep + 1} / {recipe.steps.length}
                    </span>
                    <strong>
                      {wakeLock ? "Screen awake" : "Bake mode active"}
                    </strong>
                  </button>
                  <button
                    onClick={() => setStep(activeStep + 1)}
                    disabled={activeStep === recipe.steps.length - 1}
                    aria-label="Next step"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button className="bake-mode-exit" onClick={toggleBakeMode}>
                    Done
                  </button>
                </>
              ) : (
                <button className="bake-mode-start" onClick={toggleBakeMode}>
                  <Play size={17} fill="currentColor" />
                  Start guided bake
                  <span>{recipe.steps.length} steps</span>
                </button>
              )}
            </div>
          </motion.article>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
