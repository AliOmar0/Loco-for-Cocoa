import {
  BookOpen,
  Cookie,
  FlaskConical,
  Heart,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { motion, useScroll, useSpring } from "motion/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type SiteHeaderProps = {
  favoritesCount: number;
  onOpenSearch: () => void;
  onShowFavorites: () => void;
};

export function SiteHeader({
  favoritesCount,
  onOpenSearch,
  onShowFavorites,
}: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 220, damping: 38 });

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <>
      <motion.div className="page-progress" style={{ scaleX }} />
      <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
        <a className="wordmark" href="#top" aria-label="Loco for Cocoa home">
          <span className="wordmark-orbit">
            <Sparkles size={17} />
          </span>
          <span>
            <strong>Loco for Cocoa</strong>
            <small>sweet things, no gatekeeping</small>
          </span>
        </a>

        <nav className="header-nav" aria-label="Primary navigation">
          <a href="#recipes">Recipes</a>
          <a href="#flavor-lab">Flavor lab</a>
          <a href="#field-notes">Field notes</a>
        </nav>

        <div className="header-tools">
          <button className="round-control search-control" onClick={onOpenSearch}>
            <Search size={18} />
            <span>Search</span>
            <kbd>⌘K</kbd>
          </button>
          <button
            className="round-control icon-only"
            onClick={onShowFavorites}
            aria-label="Show saved recipes"
          >
            <Heart size={18} />
            {favoritesCount > 0 && <em>{favoritesCount}</em>}
          </button>
          <Link className="studio-link" to="/studio">
            Studio
            <span>↗</span>
          </Link>
          <button
            className="round-control icon-only menu-control"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <motion.nav
          className="mobile-nav"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          <a href="#recipes" onClick={() => setMenuOpen(false)}>
            Recipes
          </a>
          <a href="#flavor-lab" onClick={() => setMenuOpen(false)}>
            Flavor lab
          </a>
          <a href="#field-notes" onClick={() => setMenuOpen(false)}>
            Field notes
          </a>
          <Link to="/studio">Open recipe studio</Link>
        </motion.nav>
      )}

      <nav className="mobile-section-dock" aria-label="Page sections">
        <a href="#recipes">
          <Cookie size={17} />
          <span>Recipes</span>
        </a>
        <a href="#flavor-lab">
          <FlaskConical size={17} />
          <span>Flavor lab</span>
        </a>
        <a href="#field-notes">
          <BookOpen size={17} />
          <span>Field notes</span>
        </a>
      </nav>
    </>
  );
}
