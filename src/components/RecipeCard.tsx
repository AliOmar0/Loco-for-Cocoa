import { ArrowUpRight, Clock3, Heart, Star } from "lucide-react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import type { Recipe } from "../types";
import { categoryLabels, moodLabels } from "../lib/recipe";
import { RecipeImage } from "./RecipeImage";

type RecipeCardProps = {
  recipe: Recipe;
  index: number;
  favorite: boolean;
  onOpen: () => void;
  onFavorite: () => void;
  sharedName?: string;
};

export function RecipeCard({
  recipe,
  index,
  favorite,
  onOpen,
  onFavorite,
  sharedName,
}: RecipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [4, -4]), {
    stiffness: 180,
    damping: 24,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-4, 4]), {
    stiffness: 180,
    damping: 24,
  });

  return (
    <motion.article
      layout
      className={`recipe-card recipe-card-${(index % 5) + 1}`}
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.55, delay: (index % 4) * 0.06 }}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      onPointerMove={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        x.set((event.clientX - rect.left) / rect.width - 0.5);
        y.set((event.clientY - rect.top) / rect.height - 0.5);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      <div className="recipe-card-surface">
        <button
          className="card-hit-area"
          onClick={onOpen}
          aria-label={`Open ${recipe.title}`}
        />
        <div className="recipe-image">
          <RecipeImage
            recipe={recipe}
            alt=""
            loading="lazy"
            sharedName={sharedName}
          />
          <div
            className="recipe-color-wash"
            style={{
              background: `linear-gradient(135deg, ${recipe.accent[0]}22, ${recipe.accent[1]}66)`,
            }}
          />
          <span className="recipe-number">
            {String(index + 1).padStart(2, "0")}
          </span>
          <button
            className={`favorite-control ${favorite ? "is-favorite" : ""}`}
            onClick={(event) => {
              event.stopPropagation();
              onFavorite();
            }}
            aria-label={favorite ? "Remove from saved recipes" : "Save recipe"}
          >
            <Heart size={18} fill={favorite ? "currentColor" : "none"} />
          </button>
          <span className="recipe-mood">{moodLabels[recipe.mood]}</span>
        </div>
        <div className="recipe-card-copy">
          <div className="recipe-eyebrow">
            <span>{categoryLabels[recipe.category]}</span>
            <span>
              <Clock3 size={13} />
              {recipe.time} min
            </span>
          </div>
          <h3>{recipe.title}</h3>
          <p>{recipe.subtitle}</p>
          <div className="recipe-card-footer">
            <span className="rating">
              <Star size={13} fill="currentColor" />
              {recipe.rating}
            </span>
            <span className="open-label">
              Open recipe
              <ArrowUpRight size={16} />
            </span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}
