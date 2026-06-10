import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Check,
  ChefHat,
  Copy,
  Download,
  Eye,
  FileText,
  GripVertical,
  Heart,
  Image as ImageIcon,
  LayoutDashboard,
  LockKeyhole,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { dessertHeroImage } from "../lib/assets";
import { categoryLabels, moodLabels, slugify } from "../lib/recipe";
import { useRecipeStore } from "../store/useRecipeStore";
import type { Recipe, RecipeCategory, RecipeMood } from "../types";

const ADMIN_PIN = "0420";

const recipeSchema = z.object({
  title: z.string().min(2, "Give this recipe a title."),
  subtitle: z.string().min(3, "Add a short hook."),
  description: z.string().min(20, "Tell visitors why this one is special."),
  category: z.enum(["cake", "cookie", "no-bake", "breakfast"]),
  mood: z.enum(["cozy", "cute", "dramatic", "quick"]),
  time: z.number().min(1),
  difficulty: z.enum(["Easy", "Medium", "Project"]),
  servings: z.number().min(1),
  image: z.string().min(1, "Add an image URL."),
  ingredients: z
    .array(z.object({ value: z.string().min(1, "Ingredient cannot be empty.") }))
    .min(1),
  steps: z
    .array(
      z.object({
        text: z.string().min(1, "Step cannot be empty."),
        duration: z.number().optional(),
      }),
    )
    .min(1),
  notes: z.string(),
  featured: z.boolean(),
  published: z.boolean(),
  accentA: z.string(),
  accentB: z.string(),
});

type RecipeFormData = z.infer<typeof recipeSchema>;

const blankRecipe = (): RecipeFormData => ({
  title: "",
  subtitle: "",
  description: "",
  category: "cake",
  mood: "cozy",
  time: 45,
  difficulty: "Easy",
  servings: 8,
  image: dessertHeroImage,
  ingredients: [{ value: "" }, { value: "" }, { value: "" }],
  steps: [{ text: "", duration: undefined }, { text: "", duration: undefined }],
  notes: "",
  featured: false,
  published: false,
  accentA: "#d83252",
  accentB: "#f0a6b2",
});

function recipeToForm(recipe: Recipe): RecipeFormData {
  return {
    title: recipe.title,
    subtitle: recipe.subtitle,
    description: recipe.description,
    category: recipe.category,
    mood: recipe.mood,
    time: recipe.time,
    difficulty: recipe.difficulty,
    servings: recipe.servings,
    image: recipe.image,
    ingredients: recipe.ingredients.map((value) => ({ value })),
    steps: recipe.steps.map((step) => ({ ...step })),
    notes: recipe.notes,
    featured: recipe.featured,
    published: recipe.published,
    accentA: recipe.accent[0],
    accentB: recipe.accent[1],
  };
}

type RecipeEditorProps = {
  recipe?: Recipe;
  onSaved: (id: string) => void;
  onDeleted: () => void;
};

function RecipeEditor({ recipe, onSaved, onDeleted }: RecipeEditorProps) {
  const upsertRecipe = useRecipeStore((state) => state.upsertRecipe);
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe);
  const duplicateRecipe = useRecipeStore((state) => state.duplicateRecipe);
  const [tab, setTab] = useState<"content" | "method" | "preview">("content");
  const [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<RecipeFormData>({
    resolver: zodResolver(recipeSchema),
    defaultValues: recipe ? recipeToForm(recipe) : blankRecipe(),
  });

  const ingredientFields = useFieldArray({ control, name: "ingredients" });
  const stepFields = useFieldArray({ control, name: "steps" });
  const values = watch();

  useEffect(() => {
    reset(recipe ? recipeToForm(recipe) : blankRecipe());
    setSaved(false);
    setTab("content");
  }, [recipe, reset]);

  const submit = handleSubmit((data) => {
    const now = new Date().toISOString();
    const id = recipe?.id || `${slugify(data.title)}-${Date.now().toString().slice(-4)}`;
    const next: Recipe = {
      id,
      title: data.title,
      subtitle: data.subtitle,
      description: data.description,
      category: data.category,
      mood: data.mood,
      time: data.time,
      difficulty: data.difficulty,
      servings: data.servings,
      image: data.image,
      ingredients: data.ingredients.map((item) => item.value),
      steps: data.steps,
      notes: data.notes,
      featured: data.featured,
      published: data.published,
      rating: recipe?.rating || 5,
      saves: recipe?.saves || 0,
      accent: [data.accentA, data.accentB],
      createdAt: recipe?.createdAt || now,
      updatedAt: now,
    };
    upsertRecipe(next);
    setSaved(true);
    reset(data);
    onSaved(id);
    window.setTimeout(() => setSaved(false), 2200);
  });

  return (
    <form className="studio-editor" onSubmit={submit}>
      <div className="editor-topbar">
        <div>
          <span>{recipe ? "Editing recipe" : "New recipe"}</span>
          <h2>{values.title || "Untitled sweet thing"}</h2>
        </div>
        <div className="editor-state">
          <span className={isDirty ? "is-dirty" : ""}>
            {saved ? <Check size={13} /> : null}
            {saved ? "Saved" : isDirty ? "Unsaved changes" : "All changes saved"}
          </span>
          <button className="studio-primary" type="submit">
            {values.published ? "Save & publish" : "Save draft"}
            <ArrowUpRight size={16} />
          </button>
        </div>
      </div>

      <div className="editor-tabs" role="tablist">
        <button
          type="button"
          className={tab === "content" ? "is-active" : ""}
          onClick={() => setTab("content")}
        >
          <FileText size={15} />
          Story
        </button>
        <button
          type="button"
          className={tab === "method" ? "is-active" : ""}
          onClick={() => setTab("method")}
        >
          <ChefHat size={15} />
          Ingredients & method
        </button>
        <button
          type="button"
          className={tab === "preview" ? "is-active" : ""}
          onClick={() => setTab("preview")}
        >
          <Eye size={15} />
          Live preview
        </button>
      </div>

      <AnimatePresence mode="wait">
        {tab === "content" && (
          <motion.div
            key="content"
            className="editor-canvas"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <section className="editor-section">
              <div className="editor-section-title">
                <span>01</span>
                <div>
                  <h3>Name the feeling</h3>
                  <p>The first lines visitors see in the archive.</p>
                </div>
              </div>
              <div className="editor-fields two-columns">
                <label className="wide-field">
                  <span>Recipe title</span>
                  <input {...register("title")} placeholder="Midnight chocolate cake" />
                  {errors.title && <small>{errors.title.message}</small>}
                </label>
                <label className="wide-field">
                  <span>One-line hook</span>
                  <input {...register("subtitle")} placeholder="Deep, glossy, worth every dish" />
                  {errors.subtitle && <small>{errors.subtitle.message}</small>}
                </label>
                <label>
                  <span>Category</span>
                  <select {...register("category")}>
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Emotional weather</span>
                  <select {...register("mood")}>
                    {Object.entries(moodLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide-field">
                  <span>Description</span>
                  <textarea
                    {...register("description")}
                    rows={4}
                    placeholder="What makes this recipe worth stopping the scroll for?"
                  />
                  {errors.description && <small>{errors.description.message}</small>}
                </label>
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-title">
                <span>02</span>
                <div>
                  <h3>Set the scene</h3>
                  <p>Image, palette, time, and practical details.</p>
                </div>
              </div>
              <div className="editor-fields two-columns">
                <label className="wide-field">
                  <span>Image URL</span>
                  <div className="field-with-icon">
                    <ImageIcon size={16} />
                    <input {...register("image")} placeholder="https://..." />
                  </div>
                  {errors.image && <small>{errors.image.message}</small>}
                </label>
                <label>
                  <span>Total time</span>
                  <input type="number" {...register("time", { valueAsNumber: true })} />
                </label>
                <label>
                  <span>Servings</span>
                  <input type="number" {...register("servings", { valueAsNumber: true })} />
                </label>
                <label>
                  <span>Difficulty</span>
                  <select {...register("difficulty")}>
                    <option>Easy</option>
                    <option>Medium</option>
                    <option>Project</option>
                  </select>
                </label>
                <div className="color-pair">
                  <label>
                    <span>Accent A</span>
                    <input type="color" {...register("accentA")} />
                  </label>
                  <label>
                    <span>Accent B</span>
                    <input type="color" {...register("accentB")} />
                  </label>
                </div>
                <div className="switch-stack wide-field">
                  <label className="studio-switch">
                    <input type="checkbox" {...register("featured")} />
                    <i />
                    <span>
                      <strong>Homepage feature</strong>
                      Give this recipe priority in the archive.
                    </span>
                  </label>
                  <label className="studio-switch">
                    <input type="checkbox" {...register("published")} />
                    <i />
                    <span>
                      <strong>Published</strong>
                      Make it visible to everyone.
                    </span>
                  </label>
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {tab === "method" && (
          <motion.div
            key="method"
            className="editor-canvas"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <section className="editor-section">
              <div className="editor-section-title inline-title">
                <span>01</span>
                <div>
                  <h3>Ingredient deck</h3>
                  <p>Quantities can be scaled automatically by visitors.</p>
                </div>
                <button
                  type="button"
                  onClick={() => ingredientFields.append({ value: "" })}
                >
                  <Plus size={15} />
                  Add ingredient
                </button>
              </div>
              <div className="field-array">
                {ingredientFields.fields.map((field, index) => (
                  <div key={field.id}>
                    <GripVertical size={16} />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <input
                      {...register(`ingredients.${index}.value`)}
                      placeholder="1 cup all-purpose flour"
                    />
                    <button
                      type="button"
                      onClick={() => ingredientFields.remove(index)}
                      aria-label="Remove ingredient"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-title inline-title">
                <span>02</span>
                <div>
                  <h3>Method timeline</h3>
                  <p>Optional timers become interactive in bake mode.</p>
                </div>
                <button
                  type="button"
                  onClick={() => stepFields.append({ text: "", duration: undefined })}
                >
                  <Plus size={15} />
                  Add step
                </button>
              </div>
              <div className="step-array">
                {stepFields.fields.map((field, index) => (
                  <div key={field.id}>
                    <div className="step-index">
                      <GripVertical size={15} />
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <textarea
                      {...register(`steps.${index}.text`)}
                      rows={3}
                      placeholder="Describe one clear action..."
                    />
                    <label>
                      <span>Timer</span>
                      <input
                        type="number"
                        placeholder="min"
                        {...register(`steps.${index}.duration`, {
                          setValueAs: (value) =>
                            value === "" ? undefined : Number(value),
                        })}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => stepFields.remove(index)}
                      aria-label="Remove step"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="editor-section">
              <div className="editor-section-title">
                <span>03</span>
                <div>
                  <h3>Leave the good note</h3>
                  <p>The substitution, storage tip, or tiny detail that saves the bake.</p>
                </div>
              </div>
              <label className="single-editor-field">
                <textarea
                  {...register("notes")}
                  rows={4}
                  placeholder="The detail you wish every recipe told you..."
                />
              </label>
            </section>
          </motion.div>
        )}

        {tab === "preview" && (
          <motion.div
            key="preview"
            className="editor-preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <div className="preview-device">
              <div className="preview-browser">
                <span />
                <span />
                <span />
                <em>locoforcocoa.local/recipes/{slugify(values.title || "untitled")}</em>
              </div>
              <article className="preview-card">
                <div className="preview-image">
                  <img
                    src={values.image || dessertHeroImage}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.src = dessertHeroImage;
                    }}
                  />
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${values.accentA}33, ${values.accentB}88)`,
                    }}
                  />
                  <span>{moodLabels[values.mood as RecipeMood]}</span>
                </div>
                <div>
                  <small>
                    {categoryLabels[values.category as RecipeCategory]} · {values.time} min
                  </small>
                  <h3>{values.title || "Untitled sweet thing"}</h3>
                  <p>{values.subtitle || "Your short, delicious hook appears here."}</p>
                  <footer>
                    <span>{values.difficulty}</span>
                    <span>{values.servings} servings</span>
                  </footer>
                </div>
              </article>
            </div>
            <p className="preview-note">
              This preview uses the same content model as the live visitor card.
              Save the recipe to publish changes to the archive.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="editor-danger-zone">
        <div>
          <strong>Recipe actions</strong>
          <span>Duplicate for a variation, or remove it from this browser.</span>
        </div>
        <div>
          {recipe && (
            <button
              type="button"
              onClick={() => {
                const id = duplicateRecipe(recipe.id);
                if (id) onSaved(id);
              }}
            >
              <Copy size={15} />
              Duplicate
            </button>
          )}
          {recipe && (
            <button
              type="button"
              className="danger-button"
              onClick={() => {
                if (window.confirm(`Delete "${recipe.title}"?`)) {
                  deleteRecipe(recipe.id);
                  onDeleted();
                }
              }}
            >
              <Trash2 size={15} />
              Delete
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

function StudioLogin({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  return (
    <main className="studio-login">
      <div className="studio-login-art">
        <div className="login-orb orb-one" />
        <div className="login-orb orb-two" />
        <div className="login-grid" />
        <div className="login-wordmark">
          <span>Loco</span>
          <em>for</em>
          <span>Cocoa</span>
        </div>
      </div>
      <motion.form
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        onSubmit={(event) => {
          event.preventDefault();
          if (pin === ADMIN_PIN) {
            sessionStorage.setItem("loco-studio-unlocked", "true");
            onUnlock();
          } else {
            setError("That PIN is not on the prep list.");
          }
        }}
      >
        <Link to="/">
          <ArrowLeft size={16} />
          Back to the archive
        </Link>
        <div className="login-icon">
          <LockKeyhole size={24} />
        </div>
        <span>Private kitchen / owner access</span>
        <h1>Open the recipe studio.</h1>
        <p>
          Draft, test, and publish sweet things from one very organized counter.
        </p>
        <label>
          <span>Kitchen PIN</span>
          <input
            autoFocus
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              setError("");
            }}
            placeholder="Try 0420"
          />
        </label>
        <small className="login-error">{error}</small>
        <button className="studio-primary">
          Enter studio
          <ArrowUpRight size={17} />
        </button>
        <small>Demo access: 0420 · Change the PIN before publishing.</small>
      </motion.form>
    </main>
  );
}

type StudioView = "recipes" | "performance" | "saves";

function PerformanceView({ recipes }: { recipes: Recipe[] }) {
  const ranked = [...recipes].sort((a, b) => b.saves - a.saves);
  const topRecipe = ranked[0];
  const maxSaves = Math.max(...ranked.map((recipe) => recipe.saves), 1);
  const categories = (Object.keys(categoryLabels) as RecipeCategory[]).map(
    (category) => ({
      category,
      count: recipes.filter((recipe) => recipe.category === category).length,
      saves: recipes
        .filter((recipe) => recipe.category === category)
        .reduce((sum, recipe) => sum + recipe.saves, 0),
    }),
  );
  const maxCategorySaves = Math.max(...categories.map((item) => item.saves), 1);
  const averageRating =
    recipes.reduce((sum, recipe) => sum + recipe.rating, 0) /
    Math.max(recipes.length, 1);
  const averageTime = Math.round(
    recipes.reduce((sum, recipe) => sum + recipe.time, 0) /
      Math.max(recipes.length, 1),
  );

  return (
    <section className="studio-view performance-view">
      <article className="performance-feature">
        {topRecipe && (
          <>
            <img
              src={topRecipe.image}
              alt=""
              onError={(event) => {
                event.currentTarget.src = dessertHeroImage;
              }}
            />
            <div className="performance-feature-shade" />
            <div>
              <span>Archive leader</span>
              <h2>{topRecipe.title}</h2>
              <p>{topRecipe.subtitle}</p>
              <strong>{topRecipe.saves.toLocaleString()} saves</strong>
            </div>
          </>
        )}
      </article>

      <article className="studio-data-card category-performance">
        <header>
          <div>
            <span>Category pulse</span>
            <h2>What people are saving</h2>
          </div>
          <BarChart3 size={22} />
        </header>
        <div>
          {categories.map((item) => (
            <div className="category-bar" key={item.category}>
              <span>{categoryLabels[item.category]}</span>
              <div>
                <i
                  style={{
                    width: `${Math.max(7, (item.saves / maxCategorySaves) * 100)}%`,
                  }}
                />
              </div>
              <strong>{item.saves.toLocaleString()}</strong>
            </div>
          ))}
        </div>
      </article>

      <article className="studio-data-card recipe-ranking">
        <header>
          <div>
            <span>Top recipes</span>
            <h2>Save leaderboard</h2>
          </div>
          <Heart size={21} />
        </header>
        <div className="ranking-list">
          {ranked.slice(0, 5).map((recipe, index) => (
            <div key={recipe.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <img
                src={recipe.image}
                alt=""
                onError={(event) => {
                  event.currentTarget.src = dessertHeroImage;
                }}
              />
              <div>
                <strong>{recipe.title}</strong>
                <i>
                  <b style={{ width: `${(recipe.saves / maxSaves) * 100}%` }} />
                </i>
              </div>
              <small>{recipe.saves.toLocaleString()}</small>
            </div>
          ))}
        </div>
      </article>

      <article className="studio-data-card studio-health-card">
        <header>
          <div>
            <span>Archive health</span>
            <h2>Useful averages</h2>
          </div>
          <Eye size={21} />
        </header>
        <div className="health-metrics">
          <div>
            <strong>{averageRating.toFixed(1)}</strong>
            <span>average rating</span>
          </div>
          <div>
            <strong>{averageTime}</strong>
            <span>average minutes</span>
          </div>
          <div>
            <strong>
              {Math.round(
                (recipes.filter((recipe) => recipe.published).length /
                  Math.max(recipes.length, 1)) *
                  100,
              )}
              %
            </strong>
            <span>published</span>
          </div>
        </div>
        <p>
          These figures use the engagement values stored with each recipe and
          update as the archive changes.
        </p>
      </article>
    </section>
  );
}

function CommunitySavesView({ recipes }: { recipes: Recipe[] }) {
  const [query, setQuery] = useState("");
  const savedRecipes = useMemo(
    () =>
      [...recipes]
        .filter((recipe) =>
          recipe.title.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => b.saves - a.saves),
    [query, recipes],
  );
  const total = recipes.reduce((sum, recipe) => sum + recipe.saves, 0);
  const topMood = (Object.keys(moodLabels) as RecipeMood[])
    .map((mood) => ({
      mood,
      saves: recipes
        .filter((recipe) => recipe.mood === mood)
        .reduce((sum, recipe) => sum + recipe.saves, 0),
    }))
    .sort((a, b) => b.saves - a.saves)[0];

  return (
    <section className="studio-view community-view">
      <div className="community-summary">
        <article>
          <span>Total archive saves</span>
          <strong>{total.toLocaleString()}</strong>
          <small>across {recipes.length} recipes</small>
        </article>
        <article>
          <span>Favorite mood</span>
          <strong>{topMood ? moodLabels[topMood.mood] : "No data"}</strong>
          <small>{topMood?.saves.toLocaleString() ?? 0} saves in this mood</small>
        </article>
        <article>
          <span>Save rate leader</span>
          <strong>{savedRecipes[0]?.rating.toFixed(1) ?? "0.0"}</strong>
          <small>{savedRecipes[0]?.title ?? "Add a recipe"}</small>
        </article>
      </div>

      <article className="community-table">
        <header>
          <div>
            <span>Community library</span>
            <h2>Every recipe, ranked by love</h2>
          </div>
          <label>
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search saved recipes"
            />
          </label>
        </header>
        <div className="community-table-head">
          <span>Recipe</span>
          <span>Category</span>
          <span>Rating</span>
          <span>Saves</span>
          <span>Status</span>
        </div>
        <div className="community-rows">
          {savedRecipes.map((recipe, index) => (
            <article key={recipe.id}>
              <div className="community-recipe-cell">
                <span>{String(index + 1).padStart(2, "0")}</span>
                <img
                  src={recipe.image}
                  alt=""
                  onError={(event) => {
                    event.currentTarget.src = dessertHeroImage;
                  }}
                />
                <div>
                  <strong>{recipe.title}</strong>
                  <small>{recipe.subtitle}</small>
                </div>
              </div>
              <span>{categoryLabels[recipe.category]}</span>
              <span>{recipe.rating.toFixed(1)} / 5</span>
              <strong>{recipe.saves.toLocaleString()}</strong>
              <i className={recipe.published ? "is-live" : ""}>
                {recipe.published ? "Live" : "Draft"}
              </i>
            </article>
          ))}
        </div>
      </article>
    </section>
  );
}

export function StudioPage() {
  const recipes = useRecipeStore((state) => state.recipes);
  const replaceRecipes = useRecipeStore((state) => state.replaceRecipes);
  const resetRecipes = useRecipeStore((state) => state.resetRecipes);
  const togglePublished = useRecipeStore((state) => state.togglePublished);
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem("loco-studio-unlocked") === "true",
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    recipes[0]?.id || null,
  );
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [studioView, setStudioView] = useState<StudioView>("recipes");
  const fileInput = useRef<HTMLInputElement>(null);

  const selected = recipes.find((recipe) => recipe.id === selectedId);
  const filtered = recipes.filter((recipe) =>
    recipe.title.toLowerCase().includes(query.toLowerCase()),
  );
  const stats = useMemo(
    () => ({
      total: recipes.length,
      live: recipes.filter((recipe) => recipe.published).length,
      drafts: recipes.filter((recipe) => !recipe.published).length,
      saves: recipes.reduce((sum, recipe) => sum + recipe.saves, 0),
    }),
    [recipes],
  );
  const viewCopy = {
    recipes: {
      eyebrow: "Recipe workspace",
      title: "Good evening, baker.",
    },
    performance: {
      eyebrow: "Archive analytics",
      title: "See what is landing.",
    },
    saves: {
      eyebrow: "Community signals",
      title: "Follow the sweet spots.",
    },
  }[studioView];

  if (!unlocked) return <StudioLogin onUnlock={() => setUnlocked(true)} />;

  const exportRecipes = () => {
    const blob = new Blob([JSON.stringify(recipes, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `loco-recipes-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="studio-page">
      <aside className="studio-sidebar">
        <Link className="studio-wordmark" to="/">
          <span>
            <Sparkles size={16} />
          </span>
          <div>
            <strong>Loco for Cocoa</strong>
            <small>recipe studio</small>
          </div>
        </Link>

        <nav>
          <button
            className={studioView === "recipes" ? "is-active" : ""}
            onClick={() => setStudioView("recipes")}
          >
            <LayoutDashboard size={17} />
            Recipes
            <span>{recipes.length}</span>
          </button>
          <button
            className={studioView === "performance" ? "is-active" : ""}
            onClick={() => setStudioView("performance")}
          >
            <BarChart3 size={17} />
            Performance
            <span>{stats.live}</span>
          </button>
          <button
            className={studioView === "saves" ? "is-active" : ""}
            onClick={() => setStudioView("saves")}
          >
            <Heart size={17} />
            Community saves
            <span>{stats.saves > 999 ? `${Math.round(stats.saves / 1000)}k` : stats.saves}</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <button onClick={exportRecipes}>
            <Download size={16} />
            Export JSON
          </button>
          <button onClick={() => fileInput.current?.click()}>
            <Upload size={16} />
            Import JSON
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const parsed = JSON.parse(await file.text());
              if (Array.isArray(parsed)) {
                replaceRecipes(parsed as Recipe[]);
                setSelectedId(parsed[0]?.id || null);
              }
              event.target.value = "";
            }}
          />
          <button
            onClick={() => {
              if (window.confirm("Reset all local recipes to the starter archive?")) {
                resetRecipes();
                setSelectedId(null);
              }
            }}
          >
            <RotateCcw size={16} />
            Reset starter data
          </button>
          <Link to="/">
            <ArrowLeft size={16} />
            View live site
          </Link>
        </div>
      </aside>

      <section className="studio-workspace">
        <header className="studio-header">
          <div>
            <span>{viewCopy.eyebrow}</span>
            <h1>{viewCopy.title}</h1>
          </div>
          {studioView === "recipes" && (
            <div>
            <button
              className="studio-primary"
              onClick={() => {
                setCreating(true);
                setSelectedId(null);
              }}
            >
              <Plus size={16} />
              New recipe
            </button>
            </div>
          )}
        </header>

        <div className="studio-stats">
          <article>
            <span>Total recipes</span>
            <strong>{stats.total}</strong>
            <small>in this browser</small>
          </article>
          <article>
            <span>Published</span>
            <strong>{stats.live}</strong>
            <small>visible in archive</small>
          </article>
          <article>
            <span>Draft counter</span>
            <strong>{stats.drafts}</strong>
            <small>still being tasted</small>
          </article>
          <article>
            <span>Community saves</span>
            <strong>{stats.saves.toLocaleString()}</strong>
            <small>sample engagement</small>
          </article>
        </div>

        {studioView === "recipes" && (
          <div className="studio-content-grid">
            <aside className="recipe-manager">
            <div className="manager-heading">
              <div>
                <span>Your archive</span>
                <h2>Recipe index</h2>
              </div>
              <button
                onClick={() => {
                  setCreating(true);
                  setSelectedId(null);
                }}
                aria-label="New recipe"
              >
                <Plus size={17} />
              </button>
            </div>
            <label className="manager-search">
              <Search size={15} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a recipe"
              />
            </label>
            <div className="manager-list">
              {filtered.map((recipe) => (
                <button
                  key={recipe.id}
                  className={selectedId === recipe.id && !creating ? "is-active" : ""}
                  onClick={() => {
                    setCreating(false);
                    setSelectedId(recipe.id);
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
                      {categoryLabels[recipe.category]} · {recipe.time} min
                    </small>
                  </div>
                  <i className={recipe.published ? "is-live" : ""} />
                </button>
              ))}
            </div>
            {selected && !creating && (
              <button
                className="quick-publish"
                onClick={() => togglePublished(selected.id)}
              >
                {selected.published ? "Move selected to drafts" : "Publish selected recipe"}
              </button>
            )}
            </aside>

            <RecipeEditor
              key={creating ? "new" : selected?.id || "empty"}
              recipe={creating ? undefined : selected}
              onSaved={(id) => {
                setCreating(false);
                setSelectedId(id);
              }}
              onDeleted={() => {
                setCreating(false);
                setSelectedId(
                  recipes.find((item) => item.id !== selectedId)?.id || null,
                );
              }}
            />
          </div>
        )}

        {studioView === "performance" && <PerformanceView recipes={recipes} />}
        {studioView === "saves" && <CommunitySavesView recipes={recipes} />}
      </section>
    </main>
  );
}
