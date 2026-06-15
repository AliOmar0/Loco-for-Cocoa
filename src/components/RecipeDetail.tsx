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
  Languages,
  LoaderCircle,
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
  RecipeTranslation,
  SubstitutionOption,
} from "../types";
import { RecipeImage } from "./RecipeImage";

type RecipeDetailProps = {
  recipe: Recipe;
  favorite: boolean;
  onClose: () => void;
  onToggleFavorite: () => void;
  language: "en" | "ar";
  translation: RecipeTranslation | null;
  translationLoading: boolean;
  translationError: string;
  onLanguageChange: (language: "en" | "ar") => void;
  sharedName?: string;
};

const recipeCopy = {
  en: {
    back: "Back to archive",
    energy: "energy",
    communityScore: "community score",
    communitySaves: "community saves",
    time: "Time",
    kitchenDisaster: "Kitchen disaster",
    steps: "Steps",
    servings: "Servings",
    sweetPeople: "sweet people",
    yieldPersonality: "Yield personality",
    realisticYield: "One pan, eaten over the sink",
    politePortions: "polite portions",
    realistic: "Realistic",
    polite: "Polite",
    whatYouNeed: "What you need",
    hideExtras: "Hide extras",
    kitchenExtras: "Kitchen extras",
    saved: "Saved",
    save: "Save",
    share: "Share",
    print: "Print",
    exitBakeMode: "Exit bake mode",
    startBakeMode: "Start bake mode",
    method: "The method",
    makeItHappen: "Make it happen.",
    complete: "complete",
    step: "Step",
    of: "of",
    bakersNote: "Baker's note",
    screenAwake: "Screen awake",
    bakeModeActive: "Bake mode active",
    pause: "Pause",
    startGuidedBake: "Start guided bake",
    resetProgress: "Reset progress",
    finishRecipe: "Finish recipe",
    translationUnavailable: "Arabic translation is currently unavailable.",
  },
  ar: {
    back: "العودة إلى الوصفات",
    energy: "الطابع",
    communityScore: "تقييم المجتمع",
    communitySaves: "حفظ من المجتمع",
    time: "الوقت",
    kitchenDisaster: "فوضى المطبخ",
    steps: "الخطوات",
    servings: "الحصص",
    sweetPeople: "أشخاص محبون للحلوى",
    yieldPersonality: "حجم الحصة",
    realisticYield: "صينية واحدة تؤكل مباشرة من المطبخ",
    politePortions: "حصص مهذبة",
    realistic: "واقعية",
    polite: "مهذبة",
    whatYouNeed: "المكونات",
    hideExtras: "إخفاء الخيارات",
    kitchenExtras: "خيارات إضافية",
    saved: "محفوظة",
    save: "حفظ",
    share: "مشاركة",
    print: "طباعة",
    exitBakeMode: "إنهاء وضع الخَبز",
    startBakeMode: "بدء وضع الخَبز",
    method: "الطريقة",
    makeItHappen: "لنبدأ الخَبز.",
    complete: "مكتمل",
    step: "الخطوة",
    of: "من",
    bakersNote: "ملاحظة الخبّاز",
    screenAwake: "الشاشة ستبقى مضاءة",
    bakeModeActive: "وضع الخَبز نشط",
    pause: "إيقاف مؤقت",
    startGuidedBake: "ابدأ الخَبز الموجّه",
    resetProgress: "إعادة التقدم",
    finishRecipe: "إنهاء الوصفة",
    translationUnavailable: "الترجمة العربية غير متاحة حالياً.",
  },
} as const;

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
  language,
  translation,
  translationLoading,
  translationError,
  onLanguageChange,
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
  const isArabic = language === "ar" && Boolean(translation);
  const copy = recipeCopy[language];
  const displayRecipe = useMemo<Recipe>(() => {
    if (!isArabic || !translation) return recipe;
    return {
      ...recipe,
      title: translation.title,
      subtitle: translation.subtitle,
      description: translation.description,
      realisticYield: translation.realisticYield || recipe.realisticYield,
      ingredients: translation.ingredients,
      steps: recipe.steps.map((step, index) => ({
        ...step,
        text: translation.steps[index] || step.text,
      })),
      notes: translation.notes,
    };
  }, [isArabic, recipe, translation]);

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
    if (
      normalized.includes("next step") ||
      normalized.includes("الخطوة التالية") ||
      normalized.includes("التالي")
    ) {
      setStep(activeStep + 1);
    } else if (
      normalized.includes("previous step") ||
      normalized.includes("الخطوة السابقة") ||
      normalized.includes("السابق")
    ) {
      setStep(activeStep - 1);
    } else if (
      normalized.includes("check ingredient") ||
      normalized.includes("حدد المكون") ||
      normalized.includes("علّم المكون")
    ) {
      const next = recipe.ingredients.findIndex(
        (_, index) => !checkedIngredients.includes(index),
      );
      if (next >= 0) toggleIngredient(next);
    } else if (
      normalized.includes("complete step") ||
      normalized.includes("أكمل الخطوة")
    ) {
      toggleStep(activeStep);
    } else if (
      normalized.includes("start timer") ||
      normalized.includes("ابدأ المؤقت")
    ) {
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
    recognition.lang = language === "ar" ? "ar-SA" : "en-US";
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
            className={`recipe-detail ${bakeMode ? "is-bake-mode" : ""} ${
              language === "ar" ? "is-rtl" : ""
            }`}
            lang={language}
            dir={language === "ar" ? "rtl" : "ltr"}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <div className="detail-rail">
              <button onClick={onClose} aria-label="Back to recipes">
                <ArrowLeft size={19} />
                <span>{copy.back}</span>
              </button>
              <span>Recipe / {recipe.id}</span>
              <div className="recipe-language-switch" dir="ltr">
                <button
                  type="button"
                  className={language === "en" ? "is-active" : ""}
                  onClick={() => onLanguageChange("en")}
                  aria-pressed={language === "en"}
                >
                  EN
                </button>
                <button
                  type="button"
                  className={language === "ar" ? "is-active" : ""}
                  onClick={() => onLanguageChange("ar")}
                  aria-pressed={language === "ar"}
                  disabled={translationLoading}
                >
                  {translationLoading ? (
                    <LoaderCircle className="is-spinning" size={14} />
                  ) : (
                    <Languages size={14} />
                  )}
                  العربية
                </button>
              </div>
            </div>

            {translationError && (
              <p className="recipe-translation-error" role="alert">
                {translationError || copy.translationUnavailable}
              </p>
            )}

            <div className="detail-hero">
              <RecipeImage
                recipe={recipe}
                alt={displayRecipe.title}
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
                <span>
                  {moodLabels[recipe.mood]} {copy.energy}
                </span>
                <h2>{displayRecipe.title}</h2>
                <p>{displayRecipe.description}</p>
              </div>
              <div className="detail-score">
                <strong>{recipe.rating}</strong>
                <span>{copy.communityScore}</span>
                <small>
                  <Heart size={13} fill="currentColor" />
                  {recipe.saves.toLocaleString(language === "ar" ? "ar" : "en")}{" "}
                  {copy.communitySaves}
                </small>
              </div>
            </div>

            <div className="detail-content">
              <aside className="ingredient-panel">
                <div className="detail-meta-grid">
                  <div>
                    <Clock3 size={16} />
                    <span>{copy.time}</span>
                    <strong>{recipe.time} min</strong>
                  </div>
                  <div>
                    <ChefHat size={16} />
                    <span>{copy.kitchenDisaster}</span>
                    <strong>{recipe.kitchenMess || 3} / 5</strong>
                  </div>
                  <div>
                    <Zap size={16} />
                    <span>{copy.steps}</span>
                    <strong>{recipe.steps.length}</strong>
                  </div>
                </div>

                <div className="serving-control">
                  <div>
                    <span>{copy.servings}</span>
                    <strong>
                      {servings} {copy.sweetPeople}
                    </strong>
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
                    <span>{copy.yieldPersonality}</span>
                    <strong>
                      {realisticPortions
                        ? displayRecipe.realisticYield || copy.realisticYield
                        : `${servings} ${copy.politePortions}`}
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
                    {realisticPortions ? copy.realistic : copy.polite}
                  </button>
                </div>

                <div className="ingredient-heading">
                  <h3>{copy.whatYouNeed}</h3>
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
                    {extrasOpen ? copy.hideExtras : copy.kitchenExtras}
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
                      {recipe.nutrition && (
                        <section className="recipe-nutrition">
                          <div>
                            <span>Nutrition snapshot</span>
                            <small>
                              {recipe.nutrition.basis} · {recipe.nutrition.source}
                            </small>
                          </div>
                          <dl>
                            <div>
                              <dt>Calories</dt>
                              <dd>{recipe.nutrition.calories} kcal</dd>
                            </div>
                            <div>
                              <dt>Protein</dt>
                              <dd>{recipe.nutrition.protein} g</dd>
                            </div>
                            <div>
                              <dt>Carbs</dt>
                              <dd>{recipe.nutrition.carbohydrates} g</dd>
                            </div>
                            <div>
                              <dt>Fat</dt>
                              <dd>{recipe.nutrition.fat} g</dd>
                            </div>
                            <div>
                              <dt>Sugar</dt>
                              <dd>{recipe.nutrition.sugar} g</dd>
                            </div>
                            <div>
                              <dt>Fiber</dt>
                              <dd>{recipe.nutrition.fiber} g</dd>
                            </div>
                            <div>
                              <dt>Sodium</dt>
                              <dd>{recipe.nutrition.sodium} mg</dd>
                            </div>
                          </dl>
                          <p>
                            {recipe.nutrition.coverage
                              ? `${recipe.nutrition.coverage}. `
                              : ""}
                            {recipe.nutrition.disclaimer}
                          </p>
                        </section>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <ul className={`ingredient-list ${extrasOpen ? "has-extras" : ""}`}>
                  {displayRecipe.ingredients.map((ingredient, index) => {
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
                    {favorite ? copy.saved : copy.save}
                    <small>{recipe.saves.toLocaleString(language === "ar" ? "ar" : "en")}</small>
                  </motion.button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard?.writeText(window.location.href);
                    }}
                  >
                    <Share2 size={16} />
                    {copy.share}
                  </button>
                  <motion.button
                    whileTap={{ scaleX: 1.1, scaleY: 0.76 }}
                    transition={{ type: "spring", stiffness: 500, damping: 17 }}
                    onClick={() => window.setTimeout(() => window.print(), 220)}
                  >
                    <Printer size={16} />
                    {copy.print}
                  </motion.button>
                  <button
                    className={bakeMode ? "is-active" : ""}
                    onClick={toggleBakeMode}
                  >
                    <Play size={16} />
                    {bakeMode ? copy.exitBakeMode : copy.startBakeMode}
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
                    <span>{copy.method}</span>
                    <h3>{copy.makeItHappen}</h3>
                  </div>
                  <div className="method-progress" style={{ "--progress": `${progress}%` } as React.CSSProperties}>
                    <strong>{progress}%</strong>
                    <span>{copy.complete}</span>
                  </div>
                </div>

                {bakeMode && (
                  <div className="bake-focus-card" role="status">
                    <div>
                      <span>
                        {copy.step} {activeStep + 1} {copy.of}{" "}
                        {displayRecipe.steps.length}
                      </span>
                      <strong>{displayRecipe.steps[activeStep]?.text}</strong>
                    </div>
                    <StepTimer
                      key={activeStep}
                      step={displayRecipe.steps[activeStep]}
                      timer={session?.timers[activeStep]}
                      onChange={(timer) =>
                        updateTimer(recipe.id, activeStep, timer)
                      }
                    />
                  </div>
                )}

                <ol className="method-list">
                  {displayRecipe.steps.map((step, index) => {
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
                  <span>{copy.bakersNote}</span>
                  <p>{displayRecipe.notes}</p>
                  <button
                    onClick={() =>
                      navigator.clipboard?.writeText(displayRecipe.notes)
                    }
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
                      {copy.step} {activeStep + 1} / {displayRecipe.steps.length}
                    </span>
                    <strong>
                      {wakeLock ? copy.screenAwake : copy.bakeModeActive}
                    </strong>
                  </button>
                  <button
                    onClick={() => setStep(activeStep + 1)}
                    disabled={activeStep === displayRecipe.steps.length - 1}
                    aria-label="Next step"
                  >
                    <ChevronRight size={18} />
                  </button>
                  <button className="bake-mode-exit" onClick={toggleBakeMode}>
                    {copy.pause}
                  </button>
                </>
              ) : (
                <button className="bake-mode-start" onClick={toggleBakeMode}>
                  <Play size={17} fill="currentColor" />
                  {copy.startGuidedBake}
                  <span>
                    {displayRecipe.steps.length} {copy.steps}
                  </span>
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
                  {copy.resetProgress}
                </button>
                <button className="finish-recipe" onClick={finishRecipe}>
                  <Sparkles size={17} />
                  {copy.finishRecipe}
                </button>
              </div>
            )}
          </motion.article>
  );
}
