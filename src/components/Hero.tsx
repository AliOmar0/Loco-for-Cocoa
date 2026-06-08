import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Shuffle,
  Star,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useTransform,
} from "motion/react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { categoryLabels } from "../lib/recipe";
import type { Recipe } from "../types";

const CocoaShader = lazy(() =>
  import("./CocoaShader").then((module) => ({ default: module.CocoaShader })),
);

type HeroProps = {
  recipes: Recipe[];
  onRoulette: () => void;
  onOpenRecipe: (recipe: Recipe) => void;
};

export function Hero({ recipes, onRoulette, onOpenRecipe }: HeroProps) {
  const hero = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [compact, setCompact] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [7, -7]), {
    stiffness: 120,
    damping: 18,
  });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-7, 7]), {
    stiffness: 120,
    damping: 18,
  });
  const { scrollYProgress } = useScroll({
    target: hero,
    offset: ["start start", "end start"],
  });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 110]);
  const artY = useTransform(scrollYProgress, [0, 1], [0, 190]);
  const slides = recipes.slice(0, 6);
  const activeRecipe = slides[activeIndex] ?? recipes[0];

  useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4600);
    return () => window.clearInterval(timer);
  }, [paused, slides.length]);

  useEffect(() => {
    if (activeIndex >= slides.length) setActiveIndex(0);
  }, [activeIndex, slides.length]);

  const moveSlide = (direction: number) => {
    setActiveIndex((current) => (current + direction + slides.length) % slides.length);
  };

  return (
    <section className="hero" id="top" ref={hero}>
      {compact ? (
        <div className="mobile-hero-backdrop" aria-hidden="true" />
      ) : (
        <Suspense fallback={<div className="shader-fallback" />}>
          <CocoaShader />
        </Suspense>
      )}
      <div className="hero-shade" />

      <motion.div className="hero-copy" style={{ y: copyY }}>
        <motion.div
          className="hero-eyebrow"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Star size={12} fill="currentColor" />
          A living archive of very good sweets
        </motion.div>

        <h1>
          <motion.span
            initial={{ y: "115%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            Dessert,
          </motion.span>
          <motion.em
            initial={{ y: "115%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            but make it
          </motion.em>
          <motion.span
            initial={{ y: "115%" }}
            animate={{ y: 0 }}
            transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            cinematic.
          </motion.span>
        </h1>

        <div className="hero-bottom">
          <p>
            A living recipe archive for cakes, cookies, and the sweet little
            obsessions that deserve their own opening credits.
          </p>
          <div className="hero-actions">
            <a className="primary-button magnetic" href="#recipes">
              Explore the archive
              <ArrowDownRight size={19} />
            </a>
            <button className="ghost-button magnetic" onClick={onRoulette}>
              <Shuffle size={17} />
              Sweet roulette
            </button>
          </div>
        </div>
      </motion.div>

      <motion.div
        className="hero-art-wrap"
        style={{ y: artY, rotateX, rotateY, transformPerspective: 1100 }}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => {
          setPaused(false);
          x.set(0);
          y.set(0);
        }}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          x.set((event.clientX - rect.left) / rect.width - 0.5);
          y.set((event.clientY - rect.top) / rect.height - 0.5);
        }}
      >
        <div className="hero-art">
          <AnimatePresence mode="popLayout">
            {activeRecipe && (
              <motion.img
                key={activeRecipe.id}
                src={activeRecipe.image}
                alt={activeRecipe.title}
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                onError={(event) => {
                  event.currentTarget.src = "/assets/dessert-hero.png";
                }}
              />
            )}
          </AnimatePresence>
          <div className="hero-art-glass" />
          <motion.div
            className="art-chip art-chip-top"
            animate={{ y: [0, -8, 0], rotate: [-4, -2, -4] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span>{activeRecipe ? categoryLabels[activeRecipe.category] : "Sweet archive"}</span>
            <strong>{activeRecipe?.title ?? "Loco for Cocoa"}</strong>
          </motion.div>
          <motion.div
            className="art-chip art-chip-side"
            animate={{ x: [0, 7, 0], rotate: [5, 3, 5] }}
            transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Star size={15} fill="currentColor" />
            {activeRecipe?.rating.toFixed(1) ?? "4.9"} community mood
          </motion.div>
          <div className="art-index">
            <span>{String(activeIndex + 1).padStart(2, "0")}</span>
            <i />
            <span>{String(slides.length).padStart(2, "0")}</span>
          </div>
          <button
            className="hero-art-open"
            onClick={() => activeRecipe && onOpenRecipe(activeRecipe)}
          >
            Open recipe
            <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="hero-slider-controls" aria-label="Featured recipes">
          <button onClick={() => moveSlide(-1)} aria-label="Previous recipe">
            <ArrowLeft size={16} />
          </button>
          <div>
            {slides.map((recipe, index) => (
              <button
                key={recipe.id}
                className={index === activeIndex ? "is-active" : ""}
                onClick={() => setActiveIndex(index)}
                aria-label={`Show ${recipe.title}`}
                aria-pressed={index === activeIndex}
              />
            ))}
          </div>
          <button onClick={() => moveSlide(1)} aria-label="Next recipe">
            <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>

      <a className="hero-scroll-cue" href="#recipes">
        <span>Scroll to taste</span>
        <ArrowUpRight size={17} />
      </a>
    </section>
  );
}
