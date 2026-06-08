import {
  ArrowUpRight,
  CircleDot,
  Droplets,
  Hand,
  ThermometerSun,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

const notes = [
  {
    id: "butter",
    index: "01",
    label: "Butter check",
    title: "Press it. Do not guess it.",
    body: "Room-temperature butter should hold a fingerprint without collapsing. If it looks shiny or greasy, give it ten quiet minutes in the fridge.",
    detail: "Best for cookies, buttercream, and cakes",
    icon: Hand,
    color: "#f0a7b3",
  },
  {
    id: "brown-butter",
    index: "02",
    label: "Listen for it",
    title: "Brown butter gets quiet before it gets nutty.",
    body: "The loud bubbling softens as the water cooks away. Start watching the milk solids then, and pull the pan when they turn amber.",
    detail: "A sensory cue that beats a stopwatch",
    icon: Droplets,
    color: "#efc262",
  },
  {
    id: "cake",
    index: "03",
    label: "Cake signal",
    title: "Look at the edges before reaching for a skewer.",
    body: "A finished cake pulls a whisper away from the pan and springs back at the center. A few moist crumbs are welcome; wet batter is not.",
    detail: "Useful when oven temperatures wander",
    icon: ThermometerSun,
    color: "#aebba0",
  },
];

export function FieldNotes() {
  const [activeId, setActiveId] = useState(notes[0].id);
  const active = notes.find((note) => note.id === activeId) ?? notes[0];
  const ActiveIcon = active.icon;

  return (
    <section className="field-notes section-shell" id="field-notes">
      <div className="field-notes-sticky">
        <span className="section-index">03 / Field notes</span>
        <h2>
          The tiny details recipes usually <em>forget.</em>
        </h2>
        <p>
          Texture, sound, color, and temperature cues for the moments when
          “bake until done” is deeply unhelpful.
        </p>

        <AnimatePresence mode="wait">
          <motion.article
            key={active.id}
            className="note-reveal"
            style={{ backgroundColor: active.color }}
            initial={{ opacity: 0, y: 18, rotate: -1 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.32 }}
          >
            <div className="note-reveal-top">
              <span>{active.label}</span>
              <ActiveIcon size={23} strokeWidth={1.6} />
            </div>
            <h3>{active.title}</h3>
            <p>{active.body}</p>
            <small>
              <CircleDot size={12} />
              {active.detail}
            </small>
          </motion.article>
        </AnimatePresence>
      </div>

      <div className="field-note-list">
        {notes.map((note) => {
          const Icon = note.icon;
          const selected = note.id === active.id;
          return (
            <button
              key={note.id}
              className={selected ? "is-active" : ""}
              onClick={() => setActiveId(note.id)}
              onPointerEnter={() => setActiveId(note.id)}
              aria-pressed={selected}
            >
              <span className="field-note-index">{note.index}</span>
              <span className="field-note-icon" style={{ backgroundColor: note.color }}>
                <Icon size={19} />
              </span>
              <span>
                <small>{note.label}</small>
                <strong>{note.title}</strong>
              </span>
              <ArrowUpRight size={18} />
            </button>
          );
        })}

        <a className="field-note-archive" href="#recipes">
          <span>
            <small>Ready to use the cues?</small>
            Open the recipe archive
          </span>
          <ArrowUpRight size={20} />
        </a>
      </div>
    </section>
  );
}
