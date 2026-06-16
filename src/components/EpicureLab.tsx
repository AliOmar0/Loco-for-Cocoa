import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  FlaskConical,
  Gauge,
  Image as ImageIcon,
  Leaf,
  LoaderCircle,
  Network,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  epicureIngredientCategories,
  epicureIngredients,
} from "../data/epicureIngredients";
import {
  backendConfigured,
  generateAiRecipe,
  generateAiRecipeImage,
  getAiProviderStatus,
  getEpicurePairings,
  type AiProviderStatus,
  type AiRecipeDraft,
  type EpicurePairings,
} from "../lib/backend";
import type {
  DietaryTag,
  RecipeCategory,
  RecipeDifficulty,
  RecipeMood,
  RecipeStep,
} from "../types";

const EPICURE_URL = "https://epicure.kaikaku.ai";
const EPICURE_ABOUT_URL = "https://epicure.kaikaku.ai/about";

const sweetStartingPoints = [
  "chocolate",
  "cocoa",
  "strawberry",
  "coffee",
  "hazelnut",
  "pistachio",
  "tahini",
  "black_sesame",
  "cherry",
  "orange",
  "cardamom",
  "miso",
];

type EpicureBrief = {
  ingredients: string[];
  category: RecipeCategory;
  complexity: RecipeDifficulty;
  servings: number;
  cuisine: string;
  specialRequests: string;
  avoidIngredients: string[];
  pairingIntent: "comfort" | "balanced" | "adventurous";
  sweetness: number;
  texture: "fudgy" | "creamy" | "crisp" | "airy" | "chewy";
  vegetarian: boolean;
  plantBased: boolean;
  zeroAddedSugar: boolean;
  generateImage: boolean;
};

export type EpicureDraft = Partial<AiRecipeDraft> & {
  title: string;
  ingredients: string[];
  steps: RecipeStep[];
  mood?: RecipeMood;
};

type EpicureLabProps = {
  authToken: string;
  storageKey: string;
  currentIngredients: string[];
  initialCategory: RecipeCategory;
  initialDifficulty: RecipeDifficulty;
  initialServings: number;
  initialDietary: DietaryTag[];
  onApplyDraft: (draft: EpicureDraft) => void;
  onUseIngredients: (ingredients: string[]) => void;
};

function displayName(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ingredientName(value: string) {
  return value
    .replace(
      /^\s*[\d./⅛¼⅓½⅔¾⅜⅝⅞-]+\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|g|kg|ml|l|oz|ounces?|lb|pounds?|large|small|medium)?\s*/i,
      "",
    )
    .replace(/,\s*.*$/, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function parseFallbackDraft(input: string): EpicureDraft {
  const cleaned = input
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const parsed = JSON.parse(
    cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1),
  ) as Record<string, unknown>;
  const ingredients = Array.isArray(parsed.ingredients)
    ? parsed.ingredients.map(String).filter(Boolean)
    : [];
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps
        .map((step): RecipeStep | null => {
          if (typeof step === "string") return { text: step };
          if (!step || typeof step !== "object") return null;
          const row = step as Record<string, unknown>;
          const text = String(row.text || row.instruction || "").trim();
          return text
            ? {
                text,
                ...(Number(row.duration) > 0
                  ? { duration: Number(row.duration) }
                  : {}),
              }
            : null;
        })
        .filter((step): step is RecipeStep => Boolean(step))
    : [];
  const title = String(parsed.title || parsed.name || "").trim();
  if (!title || !ingredients.length || !steps.length) {
    throw new Error("The JSON needs a title, ingredients, and method steps.");
  }
  return {
    title,
    subtitle: String(parsed.subtitle || "").trim() || undefined,
    description: String(parsed.description || "").trim() || undefined,
    ingredients,
    steps,
    notes: String(parsed.notes || "").trim() || undefined,
  };
}

export function EpicureLab({
  authToken,
  storageKey,
  currentIngredients,
  initialCategory,
  initialDifficulty,
  initialServings,
  initialDietary,
  onApplyDraft,
  onUseIngredients,
}: EpicureLabProps) {
  const [brief, setBrief] = useState<EpicureBrief>(() => {
    const fallback: EpicureBrief = {
      ingredients: [],
      category: initialCategory,
      complexity: initialDifficulty,
      servings: initialServings,
      cuisine: "",
      specialRequests: "",
      avoidIngredients: [],
      pairingIntent: "balanced",
      sweetness: 3,
      texture: "fudgy",
      vegetarian: initialDietary.includes("vegetarian"),
      plantBased: initialDietary.includes("vegan"),
      zeroAddedSugar: initialDietary.includes("zero-added-sugar"),
      generateImage: true,
    };
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
    } catch {
      return fallback;
    }
  });
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [pairings, setPairings] = useState<EpicurePairings | null>(null);
  const [generated, setGenerated] = useState<AiRecipeDraft | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [providers, setProviders] = useState<AiProviderStatus | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [generationBusy, setGenerationBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState("");
  const [status, setStatus] = useState("");
  const [fallbackJson, setFallbackJson] = useState("");
  const labGridRef = useRef<HTMLDivElement>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(brief));
  }, [brief, storageKey]);

  useEffect(() => {
    if (!backendConfigured || !authToken) return;
    getAiProviderStatus(authToken)
      .then(setProviders)
      .catch(() => setProviders(null));
  }, [authToken]);

  useEffect(() => {
    if (providers && !providers.freeImage && brief.generateImage) {
      setBrief((current) => ({ ...current, generateImage: false }));
    }
  }, [brief.generateImage, providers]);

  useLayoutEffect(() => {
    const grid = labGridRef.current;
    if (!grid || typeof ResizeObserver === "undefined") return;
    const panels = Array.from(
      grid.querySelectorAll<HTMLElement>(":scope > .epicure-panel"),
    );

    const arrange = () => {
      const singleColumn = window.matchMedia("(max-width: 1180px)").matches;
      panels.forEach((panel) => {
        panel.style.gridRowEnd = "auto";
      });
      if (singleColumn) return;

      const styles = window.getComputedStyle(grid);
      const rowHeight = Number.parseFloat(styles.gridAutoRows) || 8;
      const rowGap = Number.parseFloat(styles.rowGap) || 14;
      panels.forEach((panel) => {
        const height = panel.scrollHeight;
        panel.style.gridRowEnd = `span ${Math.ceil(
          (height + rowGap) / (rowHeight + rowGap),
        )}`;
      });
    };

    const observer = new ResizeObserver(arrange);
    panels.forEach((panel) => observer.observe(panel));
    window.addEventListener("resize", arrange);
    const frame = window.requestAnimationFrame(arrange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", arrange);
      observer.disconnect();
    };
  }, []);

  const searchResults = useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase().replace(/\s+/g, "_");
    if (!normalized && categoryFilter === "All") return [];
    return epicureIngredients
      .filter(
        (ingredient) =>
          categoryFilter === "All" || ingredient.category === categoryFilter,
      )
      .filter(
        (ingredient) =>
          !normalized ||
          ingredient.name.includes(normalized) ||
          ingredient.category.toLowerCase().includes(normalized),
      )
      .filter(
        (ingredient) =>
          !brief.ingredients.some(
            (selected) => selected.toLowerCase() === ingredient.name,
          ),
      )
      .slice(0, 24);
  }, [brief.ingredients, categoryFilter, deferredQuery]);

  const briefReadiness = useMemo(() => {
    const checks = [
      brief.ingredients.length >= 2,
      Boolean(brief.category),
      Boolean(brief.texture),
      Boolean(brief.pairingIntent),
      brief.servings > 0,
      providers?.recipe ?? false,
    ];
    return Math.round(
      (checks.filter(Boolean).length / checks.length) * 100,
    );
  }, [brief, providers?.recipe]);

  const addIngredient = (value: string) => {
    const normalized = ingredientName(value);
    if (!normalized) return;
    if (brief.ingredients.length >= 12) {
      setStatus("The flavour graph supports up to 12 anchor ingredients.");
      return;
    }
    setBrief((current) =>
      current.ingredients.some(
        (ingredient) => ingredient.toLowerCase() === normalized,
      )
        ? current
        : { ...current, ingredients: [...current.ingredients, normalized] },
    );
    setQuery("");
    setPairings(null);
    setGenerated(null);
  };

  const requestPairings = async () => {
    if (!brief.ingredients.length) {
      setStatus("Choose at least one ingredient first.");
      return;
    }
    setPairingBusy(true);
    setStatus("");
    try {
      const result = await getEpicurePairings(
        {
          ingredients: brief.ingredients,
          vegetarian: brief.vegetarian,
          plantBased: brief.plantBased,
        },
        authToken,
      );
      setPairings(result);
      setStatus(
        `Epicure mapped ${result.suggestions.length} pairing possibilities.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Epicure could not calculate those pairings.",
      );
    } finally {
      setPairingBusy(false);
    }
  };

  const requestRecipe = async () => {
    if (!brief.ingredients.length) {
      setStatus("Choose at least one ingredient first.");
      return;
    }
    setGenerationBusy(true);
    setGenerated(null);
    setWarnings([]);
    setImageError("");
    setStatus("Mapping flavour relationships and developing the recipe...");
    try {
      const result = await generateAiRecipe(brief, authToken);
      setGenerated(result.recipe);
      setPairings(result.pairings);
      setWarnings(result.warnings);
      setImageError(result.imageGeneration.message || "");
      setStatus(
        `${result.recipe.title} is ready to review before it enters the editor.`,
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "The recipe could not be generated.",
      );
    } finally {
      setGenerationBusy(false);
    }
  };

  const requestThumbnail = async () => {
    if (!generated) return;
    setImageBusy(true);
    setImageError("");
    try {
      const result = await generateAiRecipeImage(
        {
          title: generated.title,
          imagePrompt: generated.imagePrompt,
        },
        authToken,
      );
      setGenerated((current) =>
        current ? { ...current, image: result.image } : current,
      );
      setWarnings((current) =>
        current.filter(
          (warning) =>
            !/imagen|thumbnail|blob|gemini/i.test(warning),
        ),
      );
      setStatus("The new thumbnail is stored in Vercel Blob and attached.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "The thumbnail could not be generated.";
      setImageError(message);
      setStatus(message);
    } finally {
      setImageBusy(false);
    }
  };

  return (
    <motion.section
      className="epicure-lab editor-canvas"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
    >
      <header className="epicure-lab-hero">
        <div>
          <span>
            <FlaskConical size={14} />
            Epicure-powered recipe studio
          </span>
          <h3>Build a dessert from flavour chemistry.</h3>
          <p>
            Search Epicure's complete ingredient vocabulary, map pairings, then
            generate an editable recipe with nutrition and an optional image.
          </p>
        </div>
        <a href={EPICURE_ABOUT_URL} target="_blank" rel="noreferrer">
          How Epicure works
          <ExternalLink size={15} />
        </a>
      </header>

      <div className="epicure-provider-strip">
        <span className={backendConfigured && (providers?.epicure ?? true) ? "is-ready" : ""}>
          <Network size={16} />
          <span>Epicure graph</span>
          <small>{backendConfigured ? "ready" : "connect backend"}</small>
        </span>
        <span className={providers?.recipe ? "is-ready" : ""}>
          <WandSparkles size={16} />
          <span>Recipe AI</span>
          <small>
            {providers?.recipe
              ? "ready"
              : providers?.missing.recipe.includes("DEEPSEEK_API_KEY")
                ? "add DeepSeek key"
                : "checking"}
          </small>
        </span>
        <span className={providers?.nutrition ? "is-ready" : ""}>
          <FlaskConical size={16} />
          <span>USDA nutrition</span>
          <small>
            {providers?.nutrition
              ? "ready"
              : providers?.missing.nutrition.includes("USDA_API_KEY")
                ? "optional key"
                : "checking"}
          </small>
        </span>
        <span className={providers?.freeImage ? "is-ready" : ""}>
          <ImageIcon size={16} />
          <span>AI thumbnail</span>
          <small>
            {providers?.freeImage
              ? "free renderer ready"
              : providers?.missing.image.includes("BLOB_READ_WRITE_TOKEN")
                  ? "connect Blob"
                  : providers?.missing.image.includes("POLLINATIONS_API_KEY")
                    ? "add free image key"
                  : "checking"}
          </small>
        </span>
      </div>

      <div className="epicure-brief-dashboard">
        <div className="epicure-readiness-ring">
          <Gauge size={20} />
          <span>
            <strong>{briefReadiness}%</strong>
            brief ready
          </span>
        </div>
        <div>
          <span>Anchors</span>
          <strong>{brief.ingredients.length}/12</strong>
        </div>
        <div>
          <span>Direction</span>
          <strong>{brief.pairingIntent}</strong>
        </div>
        <div>
          <span>Finish</span>
          <strong>{brief.texture}</strong>
        </div>
        <p>
          {brief.ingredients.length >= 2
            ? "The brief has enough structure to generate."
            : "Choose at least two anchors for a more intentional result."}
        </p>
      </div>

      <div className="epicure-lab-grid" ref={labGridRef}>
        <section className="epicure-panel epicure-ingredients">
          <div className="epicure-panel-heading">
            <span>
              <Search size={18} />
              <small>01</small>
            </span>
            <div>
              <h4>Search 1,790 ingredients</h4>
              <p>Choose the anchors Epicure should build the flavour graph around.</p>
            </div>
          </div>

          <div className="epicure-selected">
            {brief.ingredients.length ? (
              brief.ingredients.map((ingredient) => (
                <button
                  type="button"
                  key={ingredient}
                  onClick={() =>
                    setBrief((current) => ({
                      ...current,
                      ingredients: current.ingredients.filter(
                        (item) => item !== ingredient,
                      ),
                    }))
                  }
                >
                  {displayName(ingredient)}
                  <X size={12} />
                </button>
              ))
            ) : (
              <p>No anchors yet. Chocolate remains an excellent life choice.</p>
            )}
          </div>

          <div className="epicure-catalogue-search">
            <label className="epicure-ingredient-input">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chocolate, fruit, spice..."
              />
            </label>
            <label>
              <span className="sr-only">Ingredient category</span>
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
              >
                {epicureIngredientCategories.map((category) => (
                  <option value={category} key={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>

          {searchResults.length > 0 && (
            <div className="epicure-search-results">
              {searchResults.map((ingredient) => (
                <button
                  type="button"
                  key={ingredient.id}
                  onClick={() => addIngredient(ingredient.name)}
                >
                  <span>
                    <strong>{ingredient.label}</strong>
                    <small>{ingredient.category}</small>
                  </span>
                  <span>
                    {ingredient.vegan ? <Leaf size={12} /> : null}
                    <Plus size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="epicure-suggestions">
            <span>Sweet starting points</span>
            <div>
              {sweetStartingPoints.map((ingredient) => (
                <button
                  type="button"
                  key={ingredient}
                  disabled={brief.ingredients.includes(ingredient)}
                  onClick={() => addIngredient(ingredient)}
                >
                  {displayName(ingredient)}
                </button>
              ))}
            </div>
          </div>

          <div className="epicure-current-deck">
            <button
              type="button"
              onClick={() =>
                currentIngredients.forEach((ingredient) =>
                  addIngredient(ingredient),
                )
              }
            >
              <RotateCcw size={14} />
              Load current ingredient deck
            </button>
            <button
              type="button"
              disabled={!brief.ingredients.length}
              onClick={() => onUseIngredients(brief.ingredients.map(displayName))}
            >
              <ArrowUpRight size={14} />
              Add anchors to recipe
            </button>
          </div>
        </section>

        <section className="epicure-panel epicure-direction">
          <div className="epicure-panel-heading">
            <span>
              <SlidersHorizontal size={18} />
              <small>02</small>
            </span>
            <div>
              <h4>Direct the recipe</h4>
              <p>Give the model enough constraint to produce something bakeable.</p>
            </div>
          </div>

          <fieldset>
            <legend>Sweet format</legend>
            <div className="epicure-choice-grid">
              {(
                [
                  ["cake", "Layered or snack cake"],
                  ["cookie", "Cookies or bars"],
                  ["no-bake", "Chilled or no-bake"],
                  ["breakfast", "Sweet breakfast"],
                ] as [RecipeCategory, string][]
              ).map(([category, description]) => (
                <button
                  type="button"
                  key={category}
                  className={brief.category === category ? "is-active" : ""}
                  onClick={() => setBrief((current) => ({ ...current, category }))}
                >
                  <strong>{category.replace("-", " ")}</strong>
                  <small>{description}</small>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Complexity</legend>
            <div className="epicure-complexity">
              {(["Easy", "Medium", "Project"] as RecipeDifficulty[]).map(
                (complexity) => (
                  <button
                    type="button"
                    key={complexity}
                    className={brief.complexity === complexity ? "is-active" : ""}
                    onClick={() =>
                      setBrief((current) => ({ ...current, complexity }))
                    }
                  >
                    {complexity}
                  </button>
                ),
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend>Pairing personality</legend>
            <div className="epicure-segmented-control">
              {(
                [
                  ["comfort", "Familiar"],
                  ["balanced", "Curious"],
                  ["adventurous", "Wild"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className={brief.pairingIntent === value ? "is-active" : ""}
                  onClick={() =>
                    setBrief((current) => ({
                      ...current,
                      pairingIntent: value,
                    }))
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>Texture target</legend>
            <div className="epicure-texture-grid">
              {(
                ["fudgy", "creamy", "crisp", "airy", "chewy"] as const
              ).map((texture) => (
                <button
                  type="button"
                  key={texture}
                  className={brief.texture === texture ? "is-active" : ""}
                  onClick={() =>
                    setBrief((current) => ({ ...current, texture }))
                  }
                >
                  {texture}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="epicure-sweetness">
            <span>
              Sweetness
              <strong>{brief.sweetness}/5</strong>
            </span>
            <input
              type="range"
              min="1"
              max="5"
              value={brief.sweetness}
              onChange={(event) =>
                setBrief((current) => ({
                  ...current,
                  sweetness: Number(event.target.value),
                }))
              }
            />
            <small>
              {brief.sweetness <= 2
                ? "Subtle and cocoa-forward"
                : brief.sweetness >= 4
                  ? "Decadent dessert energy"
                  : "Balanced sweetness"}
            </small>
          </label>

          <div className="epicure-brief-fields">
            <label>
              <span>Servings</span>
              <input
                type="number"
                min="1"
                max="40"
                value={brief.servings}
                onChange={(event) =>
                  setBrief((current) => ({
                    ...current,
                    servings: Math.max(1, Number(event.target.value) || 1),
                  }))
                }
              />
            </label>
            <label>
              <span>Cuisine context</span>
              <input
                value={brief.cuisine}
                onChange={(event) =>
                  setBrief((current) => ({
                    ...current,
                    cuisine: event.target.value,
                  }))
                }
                placeholder="Levantine, French, Japanese..."
              />
            </label>
          </div>

          <label className="epicure-avoid-list">
            <span>Avoid ingredients</span>
            <input
              value={brief.avoidIngredients.join(", ")}
              onChange={(event) =>
                setBrief((current) => ({
                  ...current,
                  avoidIngredients: event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean)
                    .slice(0, 20),
                }))
              }
              placeholder="Peanuts, alcohol, gelatin..."
            />
            <small>Comma-separated. These stay out of the generated draft.</small>
          </label>

          <div className="epicure-diet-modes">
            <button
              type="button"
              className={brief.vegetarian ? "is-active" : ""}
              onClick={() =>
                setBrief((current) => ({
                  ...current,
                  vegetarian: !current.vegetarian,
                }))
              }
            >
              <Leaf size={15} />
              Vegetarian
              {brief.vegetarian && <Check size={13} />}
            </button>
            <button
              type="button"
              className={brief.plantBased ? "is-active" : ""}
              onClick={() =>
                setBrief((current) => ({
                  ...current,
                  plantBased: !current.plantBased,
                }))
              }
            >
              <Leaf size={15} />
              Plant-based
              {brief.plantBased && <Check size={13} />}
            </button>
            <button
              type="button"
              className={brief.zeroAddedSugar ? "is-active" : ""}
              onClick={() =>
                setBrief((current) => ({
                  ...current,
                  zeroAddedSugar: !current.zeroAddedSugar,
                }))
              }
            >
              <Sparkles size={15} />
              Zero added sugar
              {brief.zeroAddedSugar && <Check size={13} />}
            </button>
          </div>

          <label className="epicure-special-request">
            <span>Special requests</span>
            <textarea
              rows={4}
              value={brief.specialRequests}
              onChange={(event) =>
                setBrief((current) => ({
                  ...current,
                  specialRequests: event.target.value,
                }))
              }
              placeholder="One bowl, not too sweet, pantry-friendly, dramatic finish..."
            />
          </label>

          <button
            type="button"
            className={`epicure-image-toggle ${
              brief.generateImage ? "is-active" : ""
            } ${providers && !providers.freeImage ? "is-unavailable" : ""}`}
            disabled={Boolean(providers && !providers.freeImage)}
            onClick={() =>
              setBrief((current) => ({
                ...current,
                generateImage: !current.generateImage,
              }))
            }
          >
            <ImageIcon size={16} />
            <span>
              <strong>Generate an editorial thumbnail</strong>
              <small>
                {providers?.freeImage
                  ? "Free community rendering, stored in Vercel Blob"
                  : providers?.missing.image.includes("BLOB_READ_WRITE_TOKEN")
                    ? "Connect Vercel Blob to store generated thumbnails"
                    : "Add a free Pollinations key; no card is required"}
              </small>
            </span>
            <i />
          </button>
        </section>

        <section className="epicure-panel epicure-pairing-panel">
          <div className="epicure-panel-heading">
            <span>
              <Network size={18} />
              <small>03</small>
            </span>
            <div>
              <h4>Map the flavour graph</h4>
              <p>Find bridges and nearby ingredients before committing to a recipe.</p>
            </div>
          </div>
          <button
            type="button"
            className="epicure-pairing-button"
            disabled={
              !brief.ingredients.length || pairingBusy || !backendConfigured
            }
            onClick={requestPairings}
          >
            {pairingBusy ? (
              <LoaderCircle className="is-spinning" size={17} />
            ) : (
              <Sparkles size={17} />
            )}
            {pairingBusy ? "Mapping pairings..." : "Find science-backed pairings"}
          </button>

          {pairings ? (
            <div className="epicure-live-pairings">
              {pairings.bridges.length > 0 && (
                <div>
                  <span>Bridge ingredients</span>
                  <div className="epicure-pairing-flight">
                    <div>
                      {pairings.bridges.slice(0, 8).map((bridge) => (
                        <button
                          type="button"
                          key={bridge.name}
                          onClick={() => addIngredient(bridge.name)}
                        >
                          + {displayName(bridge.name)}
                          <small>{bridge.coverage}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {pairings.clusters.slice(0, 3).map((cluster) => (
                <div className="epicure-cluster" key={cluster.id}>
                  <span>{cluster.label}</span>
                  <div>
                    {cluster.ingredients.slice(0, 6).map((ingredient) => (
                      <button
                        type="button"
                        key={ingredient.name}
                        onClick={() => addIngredient(ingredient.name)}
                      >
                        {displayName(ingredient.name)}
                        <small>{Math.round(ingredient.score * 100)}%</small>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="epicure-empty-graph">
              <FlaskConical size={25} />
              <p>Your pairing map will appear here.</p>
              <small>
                Powered by Epicure's public, read-only ingredient embedding.
              </small>
            </div>
          )}
        </section>

        <section className="epicure-panel epicure-generate">
          <div className="epicure-panel-heading">
            <span>
              <WandSparkles size={18} />
              <small>04</small>
            </span>
            <div>
              <h4>Generate and review</h4>
              <p>The result stays editable and never publishes automatically.</p>
            </div>
          </div>

          {!generated ? (
            <div className="epicure-generation-launch">
              <WandSparkles size={30} />
              <h5>Turn this graph into a complete recipe.</h5>
              <p>
                DeepSeek writes the draft, USDA calculates nutrition when
                available, and the configured image renderer plates the thumbnail.
              </p>
              <button
                type="button"
                disabled={
                  !brief.ingredients.length ||
                  generationBusy ||
                  !backendConfigured ||
                  Boolean(providers && !providers.recipe)
                }
                onClick={requestRecipe}
              >
                {generationBusy ? (
                  <LoaderCircle className="is-spinning" size={17} />
                ) : (
                  <WandSparkles size={17} />
                )}
                {generationBusy ? "Developing recipe..." : "Generate recipe"}
              </button>
              {generationBusy && (
                <div className="epicure-generation-progress" aria-live="polite">
                  <span className="is-active">Map flavor graph</span>
                  <span className="is-active">Develop ratios</span>
                  <span>Calculate nutrition</span>
                  <span>Plate thumbnail</span>
                </div>
              )}
              {providers && !providers.recipe && (
                <small className="epicure-provider-help">
                  Add <code>DEEPSEEK_API_KEY</code> in Vercel, then redeploy to
                  enable recipe generation.
                </small>
              )}
            </div>
          ) : (
            <article className="epicure-generated-card">
              {generated.image ? (
                <img
                  src={generated.image}
                  alt={`AI-generated editorial preview for ${generated.title}`}
                />
              ) : (
                <div className="epicure-generated-placeholder">
                  <ImageIcon size={26} />
                  <strong>Recipe ready. Thumbnail needs attention.</strong>
                  <span>
                    The draft is safe to use; image generation can be retried
                    separately.
                  </span>
                </div>
              )}
              <div className="epicure-generated-copy">
                <span>
                  {generated.category} · {generated.time} min ·{" "}
                  {generated.difficulty}
                </span>
                <h5>{generated.title}</h5>
                <p>{generated.subtitle}</p>
                <div className="epicure-nutrition-grid">
                  <span>
                    <strong>{generated.nutrition.calories}</strong> kcal
                  </span>
                  <span>
                    <strong>{generated.nutrition.protein}g</strong> protein
                  </span>
                  <span>
                    <strong>{generated.nutrition.carbohydrates}g</strong> carbs
                  </span>
                  <span>
                    <strong>{generated.nutrition.fat}g</strong> fat
                  </span>
                </div>
                <small>
                  Per serving · {generated.nutrition.source}
                  {generated.nutrition.coverage
                    ? ` · ${generated.nutrition.coverage}`
                    : ""}
                </small>
                <div className="epicure-thumbnail-workbench">
                  <label>
                    <span>Thumbnail direction</span>
                    <textarea
                      rows={3}
                      value={generated.imagePrompt}
                      onChange={(event) =>
                        setGenerated((current) =>
                          current
                            ? {
                                ...current,
                                imagePrompt: event.target.value,
                              }
                            : current,
                        )
                      }
                    />
                  </label>
                  <button
                    type="button"
                    disabled={
                      imageBusy ||
                      !providers?.freeImage ||
                      generated.imagePrompt.trim().length < 10
                    }
                    onClick={requestThumbnail}
                  >
                    {imageBusy ? (
                      <LoaderCircle className="is-spinning" size={16} />
                    ) : (
                      <ImageIcon size={16} />
                    )}
                    {imageBusy
                      ? "Rendering..."
                      : generated.image
                        ? "Regenerate thumbnail"
                        : "Generate thumbnail"}
                  </button>
                </div>
                {imageError && (
                  <p className="epicure-image-error" role="alert">
                    <CircleAlert size={15} />
                    {imageError}
                  </p>
                )}
              </div>
              <div className="epicure-generated-actions">
                <button
                  type="button"
                  onClick={() => {
                    onApplyDraft(generated);
                    setStatus(
                      `${generated.title} is now in the editor. Review before publishing.`,
                    );
                  }}
                >
                  <Check size={16} />
                  Use this recipe
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setGenerated(null);
                    void requestRecipe();
                  }}
                >
                  <RotateCcw size={15} />
                  Regenerate
                </button>
              </div>
            </article>
          )}

          {warnings.map((warning) => (
            <p className="epicure-warning" key={warning} role="alert">
              <CircleAlert size={14} />
              {warning}
            </p>
          ))}
          {status && (
            <p className="epicure-status" aria-live="polite">
              {status}
            </p>
          )}

          <details className="epicure-import">
            <summary>Manual JSON fallback</summary>
            <p>
              Use this only when a provider is unavailable or you already have a
              compatible recipe draft.
            </p>
            <textarea
              rows={7}
              value={fallbackJson}
              onChange={(event) => setFallbackJson(event.target.value)}
              placeholder='{"title":"Midnight tahini cake","ingredients":["..."],"steps":[{"text":"..."}]}'
            />
            <button
              type="button"
              disabled={!fallbackJson.trim()}
              onClick={() => {
                try {
                  onApplyDraft(parseFallbackDraft(fallbackJson));
                  setStatus("The manual draft is now in the editor.");
                } catch (error) {
                  setStatus(
                    error instanceof Error
                      ? error.message
                      : "That draft could not be imported.",
                  );
                }
              }}
            >
              Apply manual draft
            </button>
          </details>
        </section>
      </div>

      <footer className="epicure-attribution">
        Ingredient vocabulary and pairing intelligence from{" "}
        <a href={EPICURE_URL} target="_blank" rel="noreferrer">
          Epicure by KAIKAKU
        </a>
        . Recipe generation is an independent Loco for Cocoa integration.
      </footer>
    </motion.section>
  );
}
