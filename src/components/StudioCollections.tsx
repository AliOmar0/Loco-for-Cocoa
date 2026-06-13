import {
  ArrowDown,
  ArrowUp,
  Check,
  Layers3,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { slugify } from "../lib/recipe";
import { useRecipeStore } from "../store/useRecipeStore";
import type { RecipeCollection } from "../types";

const blankCollection = (): RecipeCollection => ({
  id: `collection-${Date.now()}`,
  label: "New shelf",
  note: "Curated in Studio",
  description: "A small, useful corner of the recipe archive.",
  recipeIds: [],
  enabled: true,
  accent: "#d83252",
});

export function StudioCollections() {
  const recipes = useRecipeStore((state) => state.recipes);
  const collections = useRecipeStore((state) => state.collections);
  const upsertCollection = useRecipeStore((state) => state.upsertCollection);
  const deleteCollection = useRecipeStore((state) => state.deleteCollection);
  const reorderCollections = useRecipeStore((state) => state.reorderCollections);
  const [selectedId, setSelectedId] = useState(collections[0]?.id ?? "");
  const selected = collections.find((item) => item.id === selectedId);
  const [draft, setDraft] = useState<RecipeCollection>(
    selected ?? blankCollection(),
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (selected) setDraft(selected);
  }, [selected]);

  const publishedCount = useMemo(
    () =>
      draft.recipeIds.filter((id) =>
        recipes.some((recipe) => recipe.id === id && recipe.published),
      ).length,
    [draft.recipeIds, recipes],
  );

  const move = (direction: -1 | 1) => {
    const index = collections.findIndex((item) => item.id === draft.id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= collections.length) return;
    const ids = collections.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    reorderCollections(ids);
  };

  return (
    <section className="collections-studio">
      <aside className="collection-index">
        <header>
          <div>
            <span>Homepage curation</span>
            <h2>Collection shelves</h2>
          </div>
          <button
            aria-label="New collection"
            onClick={() => {
              const next = blankCollection();
              setSelectedId(next.id);
              setDraft(next);
            }}
          >
            <Plus size={17} />
          </button>
        </header>
        <p>
          Build themed rails, choose their order, and decide exactly which
          recipes visitors see.
        </p>
        <div>
          {collections.map((collection, index) => (
            <button
              key={collection.id}
              className={collection.id === draft.id ? "is-active" : ""}
              onClick={() => setSelectedId(collection.id)}
            >
              <i style={{ background: collection.accent }} />
              <span>
                <strong>{collection.label}</strong>
                <small>
                  {collection.recipeIds.length} recipes ·{" "}
                  {collection.enabled ? "Live" : "Hidden"}
                </small>
              </span>
              <em>{String(index + 1).padStart(2, "0")}</em>
            </button>
          ))}
        </div>
      </aside>

      <div className="collection-editor">
        <header>
          <div>
            <span>Editing shelf</span>
            <h2>{draft.label}</h2>
          </div>
          <div>
            <button onClick={() => move(-1)} aria-label="Move shelf up">
              <ArrowUp size={16} />
            </button>
            <button onClick={() => move(1)} aria-label="Move shelf down">
              <ArrowDown size={16} />
            </button>
          </div>
        </header>

        <div className="collection-form-grid">
          <label>
            <span>Shelf name</span>
            <input
              value={draft.label}
              onChange={(event) =>
                setDraft((current) => ({ ...current, label: event.target.value }))
              }
            />
          </label>
          <label>
            <span>Eyebrow note</span>
            <input
              value={draft.note}
              onChange={(event) =>
                setDraft((current) => ({ ...current, note: event.target.value }))
              }
            />
          </label>
          <label className="is-wide">
            <span>Description</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Shelf accent</span>
            <input
              type="color"
              value={draft.accent}
              onChange={(event) =>
                setDraft((current) => ({ ...current, accent: event.target.value }))
              }
            />
          </label>
          <label className="collection-live-toggle">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))
              }
            />
            <span>
              <strong>Visible on homepage</strong>
              Turn this shelf on or off without deleting it.
            </span>
          </label>
        </div>

        <div className="collection-recipe-picker">
          <header>
            <div>
              <span>Recipe lineup</span>
              <strong>
                {draft.recipeIds.length} selected · {publishedCount} published
              </strong>
            </div>
            <Layers3 size={20} />
          </header>
          <div>
            {recipes.map((recipe) => {
              const checked = draft.recipeIds.includes(recipe.id);
              return (
                <label key={recipe.id} className={checked ? "is-selected" : ""}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      setDraft((current) => ({
                        ...current,
                        recipeIds: checked
                          ? current.recipeIds.filter((id) => id !== recipe.id)
                          : [...current.recipeIds, recipe.id],
                      }))
                    }
                  />
                  <img src={recipe.image} alt="" />
                  <span>
                    <strong>{recipe.title}</strong>
                    <small>{recipe.published ? "Published" : "Draft"}</small>
                  </span>
                  {checked && <Check size={16} />}
                </label>
              );
            })}
          </div>
        </div>

        <footer>
          {collections.some((item) => item.id === draft.id) && (
            <button
              className="collection-delete"
              onClick={() => {
                if (!window.confirm(`Delete the "${draft.label}" shelf?`)) return;
                deleteCollection(draft.id);
                const next = collections.find((item) => item.id !== draft.id);
                setSelectedId(next?.id ?? "");
                setDraft(next ?? blankCollection());
              }}
            >
              <Trash2 size={16} />
              Delete shelf
            </button>
          )}
          <button
            className="studio-primary"
            onClick={() => {
              const isNew = !collections.some((item) => item.id === draft.id);
              const next = {
                ...draft,
                id: isNew
                  ? `${slugify(draft.label || "collection")}-${Date.now()
                      .toString()
                      .slice(-4)}`
                  : draft.id,
              };
              upsertCollection(next);
              setSelectedId(next.id);
              setDraft(next);
              setSaved(true);
              window.setTimeout(() => setSaved(false), 1800);
            }}
          >
            {saved ? <Check size={16} /> : <Layers3 size={16} />}
            {saved ? "Shelf saved" : "Save collection"}
          </button>
        </footer>
      </div>
    </section>
  );
}
