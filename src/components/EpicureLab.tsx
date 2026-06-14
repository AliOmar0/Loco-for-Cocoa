import {
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  FlaskConical,
  Image as ImageIcon,
  Leaf,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import {
  epicureIngredientCategories,
  epicureIngredients,
} from "../data/epicureIngredients";
import {
  backendConfigured,
  generateAiRecipe,
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
  vegetarian: boolean;
  plantBased: boolean;
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
      vegetarian: initialDietary.includes("vegetarian"),
      plantBased: initialDietary.includes("vegan"),
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
  const [status, setStatus] = useState("");
  const [fallbackJson, setFallbackJson] = useState("");

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(brief));
  }, [brief, storageKey]);

  useEffect(() => {
    if (!backendConfigured || !authToken) return;
    getAiProviderStatus(authToken)
      .then(setProviders)
      .catch(() => setProviders(null));
  }, [authToken]);

  const searchResults = useMemo(() => {
    const normalized = query.trim().toLowerCase().replace(/\s+/g, "_");
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
  }, [brief.ingredients, categoryFilter, query]);

  const addIngredient = (value: string) => {
    const normalized = ingredientName(value);
    if (!normalized) return;
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
    setStatus("Mapping flavour relationships and developing the recipe...");
    try {
      const result = await generateAiRecipe(brief, authToken);
      setGenerated(result.recipe);
      setPairings(result.pairings);
      setWarnings(result.warnings);
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
        {[
          ["Epicure graph", backendConfigured && (providers?.epicure ?? true)],
          ["Recipe AI", providers?.recipe ?? false],
          ["USDA nutrition", providers?.nutrition ?? false],
          ["Imagen thumbnail", providers?.image ?? false],
        ].map(([label, ready]) => (
          <span className={ready ? "is-ready" : ""} key={String(label)}>
            <i />
            {String(label)}
            <small>{ready ? "ready" : "needs key"}</small>
          </span>
        ))}
      </div>

      <div className="epicure-lab-grid">
        <section className="epicure-panel epicure-ingredients">
          <div className="epicure-panel-heading">
            <span>01</span>
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
            <span>02</span>
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
            }`}
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
              <small>Google Imagen 4, uploaded to your Vercel Blob store</small>
            </span>
            <i />
          </button>
        </section>

        <section className="epicure-panel epicure-pairing-panel">
          <div className="epicure-panel-heading">
            <span>03</span>
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
            <span>04</span>
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
                available, and Imagen can plate the thumbnail.
              </p>
              <button
                type="button"
                disabled={
                  !brief.ingredients.length ||
                  generationBusy ||
                  !backendConfigured
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
            </div>
          ) : (
            <article className="epicure-generated-card">
              {generated.image ? (
                <img src={generated.image} alt="" />
              ) : (
                <div className="epicure-generated-placeholder">
                  <ImageIcon size={26} />
                  <span>Thumbnail was not generated</span>
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
            <p className="epicure-warning" key={warning}>
              <CircleAlert size={14} />
              {warning}
            </p>
          ))}
          {status && <p className="epicure-status">{status}</p>}

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
