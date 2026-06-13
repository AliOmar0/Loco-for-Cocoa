import {
  Accessibility,
  Contrast,
  Eye,
  MousePointer2,
  Type,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useExperienceStore } from "../store/useExperienceStore";

export function ComfortMenu() {
  const [open, setOpen] = useState(false);
  const comfort = useExperienceStore((state) => state.comfort);
  const updateComfort = useExperienceStore((state) => state.updateComfort);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.fontScale = comfort.fontScale;
    root.dataset.contrast = comfort.contrast;
    root.dataset.visualIntensity = comfort.reducedIntensity ? "reduced" : "full";
    return () => {
      delete root.dataset.fontScale;
      delete root.dataset.contrast;
      delete root.dataset.visualIntensity;
    };
  }, [comfort]);

  return (
    <div className="comfort-menu">
      <button
        className="comfort-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label="Open comfort settings"
      >
        {open ? <X size={18} /> : <Accessibility size={19} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="comfort-panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
          >
            <header>
              <span>Comfort menu</span>
              <strong>Make the kitchen yours.</strong>
            </header>

            <div className="comfort-setting">
              <label>
                <Type size={16} />
                Text size
              </label>
              <div className="comfort-segmented">
                {(["compact", "default", "large"] as const).map((size) => (
                  <button
                    key={size}
                    className={comfort.fontScale === size ? "is-active" : ""}
                    onClick={() => updateComfort({ fontScale: size })}
                  >
                    {size === "compact" ? "A" : size === "default" ? "A+" : "A++"}
                  </button>
                ))}
              </div>
            </div>

            <button
              className={comfort.contrast === "high" ? "is-active" : ""}
              onClick={() =>
                updateComfort({
                  contrast: comfort.contrast === "high" ? "default" : "high",
                })
              }
            >
              <Contrast size={16} />
              <span>
                <strong>High contrast</strong>
                Darker type and clearer borders
              </span>
            </button>

            <button
              className={comfort.reducedIntensity ? "is-active" : ""}
              onClick={() =>
                updateComfort({ reducedIntensity: !comfort.reducedIntensity })
              }
            >
              <Eye size={16} />
              <span>
                <strong>Reduced visual intensity</strong>
                Calmer motion, shaders, and effects
              </span>
            </button>

            <button
              className={comfort.sounds ? "is-active" : ""}
              onClick={() => updateComfort({ sounds: !comfort.sounds })}
            >
              {comfort.sounds ? <Volume2 size={16} /> : <VolumeX size={16} />}
              <span>
                <strong>Kitchen feedback</strong>
                Tiny sounds and supported haptics
              </span>
            </button>

            <button
              className={comfort.cursorEffects ? "is-active" : ""}
              onClick={() =>
                updateComfort({ cursorEffects: !comfort.cursorEffects })
              }
            >
              <MousePointer2 size={16} />
              <span>
                <strong>Whisk cursor</strong>
                Cocoa powder trails on desktop
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
