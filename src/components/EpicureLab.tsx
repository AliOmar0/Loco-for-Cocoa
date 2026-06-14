import {
  ArrowUpRight,
  Check,
  Clipboard,
  Copy,
  ExternalLink,
  FlaskConical,
  Leaf,
  Link2,
  Plus,
  RotateCcw,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type {
  DietaryTag,
  RecipeCategory,
  RecipeDifficulty,
  RecipeMood,
  RecipeStep,
} from "../types";

const EPICURE_URL = "https://epicure.kaikaku.ai";
const EPICURE_MCP_URL = "https://epicure-mcp.kaikaku.ai/mcp";

const dietaryOptions: DietaryTag[] = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "egg-free",
  "nut-free",
];

const sweetIngredients = [
  "Chocolate",
  "Cocoa",
  "Strawberry",
  "Coffee",
  "Hazelnut",
  "Pistachio",
  "Tahini",
  "Black sesame",
  "Cherry",
  "Orange",
  "Cardamom",
  "Miso",
];

const studioPairings: Record<string, string[]> = {
  chocolate: ["Coffee", "Raspberry", "Hazelnut", "Orange", "Cardamom", "Tahini"],
  cocoa: ["Cinnamon", "Chili", "Coffee", "Black sesame", "Cherry", "Miso"],
  strawberry: ["Basil", "Lemon", "Vanilla", "Balsamic", "White chocolate"],
  coffee: ["Chocolate", "Cardamom", "Caramel", "Hazelnut", "Orange"],
  hazelnut: ["Chocolate", "Coffee", "Pear", "Brown butter", "Cherry"],
  pistachio: ["Rose", "Orange blossom", "Raspberry", "Lemon", "Dark chocolate"],
  tahini: ["Chocolate", "Date", "Honey", "Coffee", "Sesame"],
  "black sesame": ["Cocoa", "Strawberry", "Miso", "Coconut", "Honey"],
  cherry: ["Chocolate", "Almond", "Coffee", "Vanilla", "Black pepper"],
  orange: ["Chocolate", "Cardamom", "Pistachio", "Rosemary", "Coffee"],
  cardamom: ["Coffee", "Chocolate", "Pear", "Orange", "Pistachio"],
  miso: ["Caramel", "Chocolate", "Brown butter", "Sesame", "Maple"],
};

type EpicureBrief = {
  ingredients: string[];
  category: RecipeCategory;
  complexity: RecipeDifficulty;
  servings: number;
  cuisine: string;
  specialRequests: string;
  vegetarian: boolean;
  plantBased: boolean;
};

export type EpicureDraft = {
  title: string;
  subtitle?: string;
  description?: string;
  category?: RecipeCategory;
  mood?: RecipeMood;
  time?: number;
  difficulty?: RecipeDifficulty;
  servings?: number;
  realisticYield?: string;
  kitchenMess?: number;
  dietary?: DietaryTag[];
  ingredients: string[];
  steps: RecipeStep[];
  notes?: string;
};

type EpicureLabProps = {
  storageKey: string;
  currentIngredients: string[];
  initialCategory: RecipeCategory;
  initialDifficulty: RecipeDifficulty;
  initialServings: number;
  initialDietary: DietaryTag[];
  onApplyDraft: (draft: EpicureDraft) => void;
  onUseIngredients: (ingredients: string[]) => void;
};

function ingredientName(value: string) {
  return value
    .replace(
      /^\s*[\d./⅛¼⅓½⅔¾⅜⅝⅞-]+\s*(cups?|tbsp|tablespoons?|tsp|teaspoons?|g|kg|ml|l|oz|ounces?|lb|pounds?|large|small|medium)?\s*/i,
      "",
    )
    .replace(/,\s*.*$/, "")
    .trim();
}

function normalizeCategory(value: unknown): RecipeCategory | undefined {
  const label = String(value || "").toLowerCase();
  if (label.includes("cookie") || label.includes("biscuit")) return "cookie";
  if (label.includes("no-bake") || label.includes("no bake") || label.includes("truffle")) {
    return "no-bake";
  }
  if (label.includes("breakfast") || label.includes("toast") || label.includes("pancake")) {
    return "breakfast";
  }
  if (label.includes("cake") || label.includes("cupcake") || label.includes("dessert")) {
    return "cake";
  }
  return undefined;
}

function normalizeDifficulty(value: unknown): RecipeDifficulty | undefined {
  const label = String(value || "").toLowerCase();
  if (label.includes("project") || label.includes("fine")) return "Project";
  if (label.includes("medium") || label.includes("casual")) return "Medium";
  if (label.includes("easy") || label.includes("home")) return "Easy";
  return undefined;
}

function normalizeMood(value: unknown): RecipeMood | undefined {
  const label = String(value || "").toLowerCase();
  if (label.includes("dramatic") || label.includes("elegant")) return "dramatic";
  if (label.includes("cute") || label.includes("playful")) return "cute";
  if (label.includes("quick") || label.includes("urgent")) return "quick";
  if (label.includes("cozy") || label.includes("comfort")) return "cozy";
  return undefined;
}

function parseEpicureDraft(input: string): EpicureDraft {
  const cleaned = input
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Paste the JSON recipe returned by Epicure or your AI chat.");
  }

  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  const rawIngredients = Array.isArray(parsed.ingredients) ? parsed.ingredients : [];
  const ingredients = rawIngredients
    .map((item) =>
      typeof item === "string"
        ? item
        : typeof item === "object" && item
          ? String(
              (item as Record<string, unknown>).amount
                ? `${(item as Record<string, unknown>).amount} ${
                    (item as Record<string, unknown>).name || ""
                  }`
                : (item as Record<string, unknown>).name || "",
            )
          : "",
    )
    .map((item) => item.trim())
    .filter(Boolean);

  const rawSteps = Array.isArray(parsed.steps)
    ? parsed.steps
    : Array.isArray(parsed.method)
      ? parsed.method
      : [];
  const steps = rawSteps
    .map((item): RecipeStep | null => {
      if (typeof item === "string") return { text: item };
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const text = String(row.text || row.instruction || "").trim();
      if (!text) return null;
      const duration = Number(row.duration || row.minutes || 0);
      return {
        text,
        ...(duration > 0 ? { duration } : {}),
      };
    })
    .filter((item): item is RecipeStep => Boolean(item));

  const title = String(parsed.title || parsed.name || "").trim();
  if (!title || ingredients.length === 0 || steps.length === 0) {
    throw new Error("The draft needs a title, at least one ingredient, and one method step.");
  }

  const dietary = Array.isArray(parsed.dietary)
    ? parsed.dietary
        .map((item) => String(item).toLowerCase())
        .filter((item): item is DietaryTag =>
          dietaryOptions.includes(item as DietaryTag),
        )
    : undefined;
  const time = Number(parsed.time || parsed.totalTime || parsed.total_time || 0);
  const servings = Number(parsed.servings || parsed.yield || 0);
  const kitchenMess = Number(parsed.kitchenMess || parsed.kitchen_mess || 0);

  return {
    title,
    subtitle: String(parsed.subtitle || parsed.hook || "").trim() || undefined,
    description:
      String(parsed.description || parsed.summary || "").trim() || undefined,
    category: normalizeCategory(parsed.category || parsed.dishType || parsed.dish_type),
    mood: normalizeMood(parsed.mood),
    time: time > 0 ? time : undefined,
    difficulty: normalizeDifficulty(parsed.difficulty || parsed.complexity),
    servings: servings > 0 ? servings : undefined,
    realisticYield:
      String(parsed.realisticYield || parsed.realistic_yield || "").trim() ||
      undefined,
    kitchenMess:
      kitchenMess > 0 ? Math.max(1, Math.min(5, kitchenMess)) : undefined,
    dietary,
    ingredients,
    steps,
    notes: String(parsed.notes || parsed.tips || "").trim() || undefined,
  };
}

export function EpicureLab({
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
    };
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? { ...fallback, ...JSON.parse(stored) } : fallback;
    } catch {
      return fallback;
    }
  });
  const [ingredientInput, setIngredientInput] = useState("");
  const [importText, setImportText] = useState("");
  const [status, setStatus] = useState("");
  const [copied, setCopied] = useState<"brief" | "connector" | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(brief));
  }, [brief, storageKey]);

  const pairingIdeas = useMemo(() => {
    const ideas = brief.ingredients.flatMap(
      (item) => studioPairings[item.toLowerCase()] || [],
    );
    return [...new Set(ideas)]
      .filter(
        (item) =>
          !brief.ingredients.some(
            (selected) => selected.toLowerCase() === item.toLowerCase(),
          ),
      )
      .slice(0, 8);
  }, [brief.ingredients]);

  const prompt = useMemo(() => {
    const dietary = [
      brief.vegetarian ? "vegetarian" : "",
      brief.plantBased ? "plant-based" : "",
    ]
      .filter(Boolean)
      .join(", ");
    return `Use Epicure's flavour-pairing intelligence to design a ${
      brief.category === "no-bake" ? "no-bake dessert" : brief.category
    } for Loco for Cocoa.

Core ingredients: ${brief.ingredients.join(", ") || "choose a cocoa-friendly pairing"}
Flavour profile: sweet
Complexity: ${brief.complexity}
Servings: ${brief.servings}
Cuisine context: ${brief.cuisine || "open"}
Dietary direction: ${dietary || "none"}
Special requests: ${brief.specialRequests || "none"}

Return ONLY valid JSON. Use this exact shape:
{
  "title": "short editorial title",
  "subtitle": "one-line archive hook",
  "description": "why this dessert is special",
  "category": "${brief.category}",
  "mood": "cozy | cute | dramatic | quick",
  "time": 45,
  "difficulty": "Easy | Medium | Project",
  "servings": ${brief.servings},
  "realisticYield": "a playful realistic yield",
  "kitchenMess": 2,
  "dietary": ["vegetarian"],
  "ingredients": ["quantity + ingredient"],
  "steps": [{"text": "one clear action", "duration": 5}],
  "notes": "one practical baker's note"
}`;
  }, [brief]);

  const addIngredient = (value: string) => {
    const next = value.trim();
    if (!next) return;
    setBrief((current) =>
      current.ingredients.some(
        (ingredient) => ingredient.toLowerCase() === next.toLowerCase(),
      )
        ? current
        : { ...current, ingredients: [...current.ingredients, next] },
    );
    setIngredientInput("");
  };

  const copyText = async (value: string, type: "brief" | "connector") => {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(null), 1800);
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
            Epicure companion
          </span>
          <h3>Start with flavour, not a blank page.</h3>
          <p>
            Build an ingredient-led brief, explore science-backed pairings in
            Epicure, then import the finished draft into this editor.
          </p>
        </div>
        <a href={EPICURE_URL} target="_blank" rel="noreferrer">
          Open Epicure
          <ExternalLink size={15} />
        </a>
      </header>

      <div className="epicure-lab-grid">
        <section className="epicure-panel epicure-ingredients">
          <div className="epicure-panel-heading">
            <span>01</span>
            <div>
              <h4>Choose the flavour anchors</h4>
              <p>Epicure can use these to explore expected and unusual pairings.</p>
            </div>
          </div>

          <div className="epicure-selected">
            {brief.ingredients.length > 0 ? (
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
                  {ingredient}
                  <X size={12} />
                </button>
              ))
            ) : (
              <p>No anchors yet. Chocolate is a very reasonable beginning.</p>
            )}
          </div>

          <label className="epicure-ingredient-input">
            <Plus size={15} />
            <input
              value={ingredientInput}
              onChange={(event) => setIngredientInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addIngredient(ingredientInput.replace(/,$/, ""));
                }
              }}
              placeholder="Add chocolate, raspberry, miso..."
            />
            <button type="button" onClick={() => addIngredient(ingredientInput)}>
              Add
            </button>
          </label>

          <div className="epicure-suggestions">
            <span>Sweet starting points</span>
            <div>
              {sweetIngredients.map((ingredient) => (
                <button
                  type="button"
                  key={ingredient}
                  disabled={brief.ingredients.some(
                    (item) => item.toLowerCase() === ingredient.toLowerCase(),
                  )}
                  onClick={() => addIngredient(ingredient)}
                >
                  {ingredient}
                </button>
              ))}
            </div>
          </div>

          {pairingIdeas.length > 0 && (
            <div className="epicure-pairing-flight">
              <span>
                <Sparkles size={13} />
                Studio pairing flight
              </span>
              <div>
                {pairingIdeas.map((ingredient) => (
                  <button
                    type="button"
                    key={ingredient}
                    onClick={() => addIngredient(ingredient)}
                  >
                    + {ingredient}
                  </button>
                ))}
              </div>
              <small>
                These are local editorial suggestions. Use Epicure for its
                FlavorGraph-backed recommendations.
              </small>
            </div>
          )}

          <div className="epicure-current-deck">
            <button
              type="button"
              onClick={() =>
                setBrief((current) => ({
                  ...current,
                  ingredients: [
                    ...new Set([
                      ...current.ingredients,
                      ...currentIngredients.map(ingredientName).filter(Boolean),
                    ]),
                  ],
                }))
              }
            >
              <RotateCcw size={14} />
              Load current ingredient deck
            </button>
            <button
              type="button"
              disabled={brief.ingredients.length === 0}
              onClick={() => {
                onUseIngredients(brief.ingredients);
                setStatus("Flavour anchors added to the ingredient deck.");
              }}
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
              <p>The useful constraints from Epicure's generation wizard.</p>
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
                placeholder="Palestinian, French, Japanese..."
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
              placeholder="One bowl, not too sweet, dramatic finish, pantry-friendly..."
            />
          </label>
        </section>

        <section className="epicure-panel epicure-bridge">
          <div className="epicure-panel-heading">
            <span>03</span>
            <div>
              <h4>Take the brief to Epicure</h4>
              <p>Nothing leaves Studio until you choose to copy or open it.</p>
            </div>
          </div>
          <textarea value={prompt} readOnly rows={15} aria-label="Epicure recipe brief" />
          <div className="epicure-bridge-actions">
            <button type="button" onClick={() => copyText(prompt, "brief")}>
              {copied === "brief" ? <Check size={15} /> : <Clipboard size={15} />}
              {copied === "brief" ? "Brief copied" : "Copy generation brief"}
            </button>
            <a href={EPICURE_URL} target="_blank" rel="noreferrer">
              <WandSparkles size={15} />
              Explore pairings
              <ArrowUpRight size={14} />
            </a>
            <button
              type="button"
              onClick={() => copyText(EPICURE_MCP_URL, "connector")}
            >
              {copied === "connector" ? <Check size={15} /> : <Link2 size={15} />}
              {copied === "connector" ? "Connector copied" : "Copy MCP connector"}
            </button>
          </div>
          <small className="epicure-privacy-note">
            Epicure uses Google AI services for generation and image analysis.
            Review its privacy notice before pasting unpublished recipes.
          </small>
        </section>

        <section className="epicure-panel epicure-import">
          <div className="epicure-panel-heading">
            <span>04</span>
            <div>
              <h4>Import the generated draft</h4>
              <p>Paste the JSON response and Studio will fill every matching field.</p>
            </div>
          </div>
          <label>
            <span>Epicure JSON</span>
            <textarea
              rows={15}
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setStatus("");
              }}
              placeholder='{"title":"Midnight tahini cake","ingredients":["..."],"steps":[{"text":"..."}]}'
            />
          </label>
          <div className="epicure-import-actions">
            <button
              type="button"
              disabled={!importText.trim()}
              onClick={() => {
                try {
                  const draft = parseEpicureDraft(importText);
                  onApplyDraft(draft);
                  setStatus(
                    `${draft.title} is now in the Studio. Review it before publishing.`,
                  );
                } catch (error) {
                  setStatus(
                    error instanceof Error
                      ? error.message
                      : "That draft could not be imported.",
                  );
                }
              }}
            >
              <Copy size={15} />
              Apply draft to recipe
            </button>
          </div>
          {status && <p className="epicure-status">{status}</p>}
        </section>
      </div>
    </motion.section>
  );
}
