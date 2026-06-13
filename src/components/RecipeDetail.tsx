import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  ChefHat,
  Clock3,
  Copy,
  Dices,
  Heart,
  Mic,
  Minus,
  Plus,
  Play,
  Printer,
  RotateCw,
  Scale,
  Share2,
  Sparkles,
  TimerReset,
  Video,
  X,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatTime, moodLabels, scaleIngredient } from "../lib/recipe";
import {
  absurdUnit,
  dietaryLabels,
  filterSubstitutions,
  messLabels,
  pulseFeedback,
  substitutionsFor,
} from "../lib/recipeExtras";
import { useExperienceStore } from "../store/useExperienceStore";
import type {
  BakeTimerState,
  DietaryTag,
  Recipe,
  RecipeStep,
  SubstitutionOption,
} from "../types";
import { RecipeImage } from "./RecipeImage";

type RecipeDetailProps = {
  recipe: Recipe;
  favorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  sharedName?: string;
};

function StepTimer({
  step,
  timer,
  onChange,
}: {
  step: RecipeStep;
  timer?: BakeTimerState;
  onChange: (timer: BakeTimerState) => void;
}) {
  const total = (step.duration || 0) * 60;
  const effectiveRemaining = timer?.running
    ? Math.max(
        0,
        (timer.remaining || total) -
          Math.floor((Date.now() - timer.updatedAt) / 1000),
      )
    : timer?.remaining ?? total;
  const [remaining, setRemaining] = useState(effectiveRemaining);
  const running = Boolean(timer?.running && effectiveRemaining > 0);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    setRemaining(effectiveRemaining);
  }, [effectiveRemaining]);

  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining((value) => {
        const next = Math.max(0, value - 1);
        onChangeRef.current({
          remaining: next,
          running: next > 0,
          updatedAt: Date.now(),
        });
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  if (!step.duration) return null;

  return (
    <button
      className={`step-timer ${running ? "is-running" : ""}`}
      onClick={() => {
        const nextRemaining = remaining === 0 ? total : remaining;
        onChange({
          remaining: nextRemaining,
          running: !running,
          updatedAt: Date.now(),
        });
      }}
    >
      <TimerReset size={14} />
      {running || remaining !== total ? formatTime(remaining) : `${step.duration} min timer`}
    </button>
  );
}

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: {
    results: ArrayLike<{ 0: { transcript: string } }>;
  }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

type FaceDetectorInstance = {
  detect: (video: HTMLVideoElement) => Promise<Array<{ boundingBox: DOMRect }>>;
};

export function RecipeDetail({
  recipe,
  favorite,
  onClose,
  onToggleFavorite,
  sharedName,
}: RecipeDetailProps) {
  const bakeSessions = useExperienceStore((state) => state.bakeSessions);
  const updateBakeSession = useExperienceStore(
    (state) => state.updateBakeSession,
  );
  const updateTimer = useExperienceStore((state) => state.updateTimer);
  const clearBakeSession = useExperienceStore(
    (state) => state.clearBakeSession,
  );
  const comfort = useExperienceStore((state) => state.comfort);
  const session = recipe ? bakeSessions[recipe.id] : undefined;
  const servings = session?.servings ?? recipe?.servings ?? 1;
  const completed = session?.completed ?? [];
  const checkedIngredients = session?.checkedIngredients ?? [];
  const bakeMode = session?.bakeMode ?? false;
  const activeStep = session?.activeStep ?? 0;
  const realisticPortions = session?.realisticPortions ?? false;
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [dietaryFilters, setDietaryFilters] = useState<DietaryTag[]>([]);
  const [chaoticIngredients, setChaoticIngredients] = useState<number[]>([]);
  const [substitution, setSubstitution] = useState<{
    ingredient: string;
    option: SubstitutionOption;
  } | null>(null);
  const [voiceActive, setVoiceActive] = useState(false);
  const [gestureActive, setGestureActive] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const gestureVideo = useRef<HTMLVideoElement>(null);
  const gestureStream = useRef<MediaStream | null>(null);
  const gestureFrame = useRef(0);
  const lastFaceY = useRef<number | null>(null);
  const activeStepRef = useRef(activeStep);

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    if (!recipe) return;
    if (!bakeSessions[recipe.id]) {
      updateBakeSession(recipe.id, {
        servings: recipe.servings,
        completed: [],
        checkedIngredients: [],
        activeStep: 0,
        realisticPortions: false,
        bakeMode: false,
        timers: {},
      });
    }
  }, [bakeSessions, recipe, updateBakeSession]);

  useEffect(() => {
    setChaoticIngredients([]);
  }, [recipe?.id]);

  useEffect(
    () => () => {
      wakeLock?.release().catch(() => undefined);
      recognitionRef.current?.stop();
      window.cancelAnimationFrame(gestureFrame.current);
      gestureStream.current?.getTracks().forEach((track) => track.stop());
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
    updateBakeSession(recipe.id, { activeStep: next });
    window.setTimeout(() => {
      document
        .querySelector(`[data-method-step="${next}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  };

  const toggleBakeMode = async () => {
    if (!recipe) return;
    const next = !bakeMode;
    updateBakeSession(recipe.id, { bakeMode: next });
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

  const toggleIngredient = (index: number) => {
    if (!recipe) return;
    const next = checkedIngredients.includes(index)
      ? checkedIngredients.filter((value) => value !== index)
      : [...checkedIngredients, index];
    updateBakeSession(recipe.id, { checkedIngredients: next });
    pulseFeedback(comfort.sounds);
  };

  const toggleStep = (index: number) => {
    if (!recipe) return;
    const next = completed.includes(index)
      ? completed.filter((value) => value !== index)
      : [...completed, index];
    updateBakeSession(recipe.id, { completed: next });
    pulseFeedback(comfort.sounds);
  };

  const spinSubstitution = (ingredient: string) => {
    if (!recipe) return;
    const available = filterSubstitutions(
      substitutionsFor(recipe, ingredient),
      dietaryFilters,
    );
    const options = available.length
      ? available
      : substitutionsFor(recipe, ingredient);
    if (!options.length) {
      setSubstitution({
        ingredient,
        option: {
          label: "A tactical trip to the store",
          amount: "one pair of shoes",
          note: "The roulette found no responsible replacement for this one.",
          dietary: [],
          reliable: false,
        },
      });
      return;
    }
    setSubstitution({
      ingredient,
      option: options[Math.floor(Math.random() * options.length)],
    });
  };

  const runVoiceCommand = (command: string) => {
    if (!recipe) return;
    const normalized = command.toLowerCase();
    if (normalized.includes("next step")) setStep(activeStep + 1);
    else if (normalized.includes("previous step")) setStep(activeStep - 1);
    else if (normalized.includes("check ingredient")) {
      const next = recipe.ingredients.findIndex(
        (_, index) => !checkedIngredients.includes(index),
      );
      if (next >= 0) toggleIngredient(next);
    } else if (normalized.includes("complete step")) toggleStep(activeStep);
    else if (normalized.includes("start timer")) {
      const step = recipe.steps[activeStep];
      if (step.duration) {
        updateTimer(recipe.id, activeStep, {
          remaining: step.duration * 60,
          running: true,
          updatedAt: Date.now(),
        });
      }
    }
  };

  const toggleVoice = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    if (voiceActive) {
      recognitionRef.current?.stop();
      setVoiceActive(false);
      return;
    }
    const Recognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!Recognition) return;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const latest = event.results[event.results.length - 1];
      runVoiceCommand(latest[0].transcript);
    };
    recognition.onend = () => setVoiceActive(false);
    recognitionRef.current = recognition;
    recognition.start();
    setVoiceActive(true);
  };

  const stopGestureMode = () => {
    window.cancelAnimationFrame(gestureFrame.current);
    gestureStream.current?.getTracks().forEach((track) => track.stop());
    gestureStream.current = null;
    lastFaceY.current = null;
    setGestureActive(false);
  };

  const toggleGestureMode = async () => {
    if (gestureActive) {
      stopGestureMode();
      return;
    }
    const detectorWindow = window as Window & {
      FaceDetector?: new (options?: {
        fastMode?: boolean;
        maxDetectedFaces?: number;
      }) => FaceDetectorInstance;
    };
    if (!detectorWindow.FaceDetector || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 320, height: 240 },
      audio: false,
    });
    gestureStream.current = stream;
    const video = gestureVideo.current;
    if (!video) return;
    video.srcObject = stream;
    await video.play();
    const detector = new detectorWindow.FaceDetector({
      fastMode: true,
      maxDetectedFaces: 1,
    });
    setGestureActive(true);
    let lastAdvance = 0;
    const detect = async () => {
      try {
        const faces = await detector.detect(video);
        const y = faces[0]?.boundingBox.y;
        if (typeof y === "number" && lastFaceY.current !== null) {
          const delta = y - lastFaceY.current;
          if (delta > 18 && Date.now() - lastAdvance > 1300) {
          setStep(activeStepRef.current + 1);
            lastAdvance = Date.now();
          }
        }
        if (typeof y === "number") lastFaceY.current = y;
      } catch {
        stopGestureMode();
        return;
      }
      gestureFrame.current = window.requestAnimationFrame(detect);
    };
    detect();
  };

  const finishRecipe = async () => {
    if (!recipe) return;
    updateBakeSession(recipe.id, {
      completed: recipe.steps.map((_, index) => index),
      bakeMode: false,
    });
    pulseFeedback(comfort.sounds);
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: comfort.reducedIntensity ? 24 : 80,
      spread: 70,
      colors: ["#5c2e20", "#d83252", "#fff4df", "#efc272"],
      origin: { y: 0.78 },
    });
  };

  return (
          <motion.article
            className={`recipe-detail ${bakeMode ? "is-bake-mode" : ""}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className="detail-rail">
              <button onClick={onClose} aria-label="Back to recipes">
                <ArrowLeft size={19} />
                <span>Back to archive</span>
              </button>
              <span>Recipe / {recipe.id}</span>
              <span className="detail-rail-status">Loco for Cocoa</span>
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
                    <span>Kitchen disaster</span>
                    <strong>{recipe.kitchenMess || 3} / 5</strong>
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
                      onClick={() =>
                        updateBakeSession(recipe.id, {
                          servings: Math.max(1, servings - 1),
                        })
                      }
                      aria-label="Decrease servings"
                    >
                      <Minus size={15} />
                    </button>
                    <span>{servings}</span>
                    <button
                      onClick={() =>
                        updateBakeSession(recipe.id, { servings: servings + 1 })
                      }
                      aria-label="Increase servings"
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>

                <div className="portion-personality">
                  <div>
                    <span>Yield personality</span>
                    <strong>
                      {realisticPortions
                        ? recipe.realisticYield || "One pan, eaten over the sink"
                        : `${servings} polite portions`}
                    </strong>
                  </div>
                  <button
                    className={realisticPortions ? "is-realistic" : ""}
                    onClick={() =>
                      updateBakeSession(recipe.id, {
                        realisticPortions: !realisticPortions,
                      })
                    }
                  >
                    {realisticPortions ? "Realistic" : "Polite"}
                  </button>
                </div>

                <div className="ingredient-heading">
                  <h3>What you need</h3>
                  <button
                    className={extrasOpen ? "is-active" : ""}
                    onClick={() => {
                      setExtrasOpen((current) => {
                        if (current) setSubstitution(null);
                        return !current;
                      });
                    }}
                    aria-expanded={extrasOpen}
                  >
                    <Sparkles size={14} />
                    {extrasOpen ? "Hide extras" : "Kitchen extras"}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {extrasOpen && (
                    <motion.div
                      className="recipe-extras-panel"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <button
                        className={`extras-chaos-toggle ${
                          chaoticIngredients.length === recipe.ingredients.length
                            ? "is-active"
                            : ""
                        }`}
                        onClick={() =>
                          setChaoticIngredients((current) =>
                            current.length === recipe.ingredients.length
                              ? []
                              : recipe.ingredients.map((_, index) => index),
                          )
                        }
                      >
                        <Scale size={14} />
                        {chaoticIngredients.length === recipe.ingredients.length
                          ? "Restore standard units"
                          : "Convert every unit to chaos"}
                      </button>
                      <div className="dietary-filters">
                        <span>Emergency substitution filters</span>
                        <div>
                          {(Object.keys(dietaryLabels) as DietaryTag[]).map((tag) => (
                            <button
                              key={tag}
                              className={
                                dietaryFilters.includes(tag) ? "is-active" : ""
                              }
                              onClick={() =>
                                setDietaryFilters((current) =>
                                  current.includes(tag)
                                    ? current.filter((item) => item !== tag)
                                    : [...current, tag],
                                )
                              }
                            >
                              {dietaryLabels[tag]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <p>
                        Use the scale and dice controls beside an ingredient for
                        absurd measurements or a practical substitution.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <ul className={`ingredient-list ${extrasOpen ? "has-extras" : ""}`}>
                  {recipe.ingredients.map((ingredient, index) => {
                    const checked = checkedIngredients.includes(index);
                    return (
                    <li key={ingredient} className={checked ? "is-checked" : ""}>
                      <button
                        onClick={() => toggleIngredient(index)}
                        aria-label={`${checked ? "Uncheck" : "Check"} ${ingredient}`}
                      >
                        <span>{checked && <Check size={13} />}</span>
                        {chaoticIngredients.includes(index)
                          ? absurdUnit(ingredient)
                          : scaleIngredient(
                              ingredient,
                              realisticPortions ? 1 : servings / recipe.servings,
                            )}
                      </button>
                      {extrasOpen && (
                        <>
                          <button
                            className={`unit-chaos-button ${
                              chaoticIngredients.includes(index) ? "is-active" : ""
                            }`}
                            onClick={() =>
                              setChaoticIngredients((current) =>
                                current.includes(index)
                                  ? current.filter((item) => item !== index)
                                  : [...current, index],
                              )
                            }
                            aria-label={`${
                              chaoticIngredients.includes(index)
                                ? "Restore standard units for"
                                : "Convert to chaotic units for"
                            } ${ingredient}`}
                          >
                            <Scale size={14} />
                          </button>
                          <button
                            className="substitution-roulette"
                            onClick={() => spinSubstitution(ingredient)}
                            aria-label={`Spin emergency substitution for ${ingredient}`}
                          >
                            <Dices size={15} />
                          </button>
                        </>
                      )}
                    </li>
                    );
                  })}
                </ul>

                <AnimatePresence>
                  {extrasOpen && substitution && (
                    <motion.div
                      className={`substitution-result ${
                        substitution.option.reliable ? "is-real" : "is-chaos"
                      }`}
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      <button onClick={() => setSubstitution(null)} aria-label="Close substitution">
                        <X size={14} />
                      </button>
                      <span>
                        <RotateCw size={13} />
                        Emergency substitution roulette
                      </span>
                      <small>Instead of {substitution.ingredient}</small>
                      <strong>{substitution.option.label}</strong>
                      <em>{substitution.option.amount}</em>
                      <p>{substitution.option.note}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="mess-meter">
                  <span>The kitchen disaster forecast</span>
                  <div>
                    {[1, 2, 3, 4, 5].map((level) => (
                      <i
                        key={level}
                        className={level <= (recipe.kitchenMess || 3) ? "is-active" : ""}
                      >
                        {level}
                      </i>
                    ))}
                  </div>
                  <strong>{messLabels[(recipe.kitchenMess || 3) - 1]}</strong>
                </div>

                <div className="detail-action-grid">
                  <motion.button
                    className={favorite ? "is-active" : ""}
                    whileTap={{ scaleX: 1.08, scaleY: 0.78 }}
                    transition={{ type: "spring", stiffness: 480, damping: 18 }}
                    onClick={() => {
                      window.setTimeout(onToggleFavorite, 180);
                      pulseFeedback(comfort.sounds);
                    }}
                  >
                    <Heart size={16} fill={favorite ? "currentColor" : "none"} />
                    {favorite ? "Saved" : "Save"}
                  </motion.button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard?.writeText(window.location.href);
                    }}
                  >
                    <Share2 size={16} />
                    Share
                  </button>
                  <motion.button
                    whileTap={{ scaleX: 1.1, scaleY: 0.76 }}
                    transition={{ type: "spring", stiffness: 500, damping: 17 }}
                    onClick={() => window.setTimeout(() => window.print(), 220)}
                  >
                    <Printer size={16} />
                    Print
                  </motion.button>
                  <button
                    className={bakeMode ? "is-active" : ""}
                    onClick={toggleBakeMode}
                  >
                    <Play size={16} />
                    {bakeMode ? "Exit bake mode" : "Start bake mode"}
                  </button>
                </div>

                {extrasOpen && <div className="hands-free-controls">
                  <button
                    className={voiceActive ? "is-active" : ""}
                    onClick={toggleVoice}
                  >
                    <Mic size={16} />
                    {voiceActive ? "Listening..." : "Voice controls"}
                  </button>
                  <button
                    className={gestureActive ? "is-active" : ""}
                    onClick={toggleGestureMode}
                  >
                    <Video size={16} />
                    {gestureActive ? "Nod mode on" : "Hands covered mode"}
                  </button>
                  <p>
                    Say “next step,” “check ingredient,” “complete step,” or
                    “start timer.” On supported browsers, a strong downward nod
                    advances the method.
                  </p>
                  <video ref={gestureVideo} muted playsInline aria-hidden="true" />
                </div>}
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
                      timer={session?.timers[activeStep]}
                      onChange={(timer) =>
                        updateTimer(recipe.id, activeStep, timer)
                      }
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
                        onClick={() => bakeMode && setStep(index)}
                      >
                        <button
                          className="step-check"
                          onClick={() => toggleStep(index)}
                          aria-label={`Mark step ${index + 1} ${isComplete ? "incomplete" : "complete"}`}
                        >
                          {isComplete ? <Check size={17} /> : String(index + 1).padStart(2, "0")}
                        </button>
                        <div>
                          <p>{step.text}</p>
                          <StepTimer
                            step={step}
                            timer={session?.timers[index]}
                            onChange={(timer) =>
                              updateTimer(recipe.id, index, timer)
                            }
                          />
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
                    Pause
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

            {bakeMode && (
              <div className="bake-completion-actions">
                <button
                  className="reset-bake-progress"
                  onClick={() => {
                    if (!recipe) return;
                    clearBakeSession(recipe.id);
                    stopGestureMode();
                    onClose();
                  }}
                >
                  <RotateCw size={16} />
                  Reset progress
                </button>
                <button className="finish-recipe" onClick={finishRecipe}>
                  <Sparkles size={17} />
                  Finish recipe
                </button>
              </div>
            )}
          </motion.article>
  );
}
