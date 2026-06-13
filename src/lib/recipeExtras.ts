import type {
  DietaryTag,
  IngredientSubstitution,
  Recipe,
  SubstitutionOption,
} from "../types";

export const dietaryLabels: Record<DietaryTag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  "egg-free": "Egg-free",
  "nut-free": "Nut-free",
};

export const messLabels = [
  "Only a bowl to wash",
  "A respectable little stack",
  "The counter has seen things",
  "Every spoon is somehow involved",
  "Apologize to whoever cleans the kitchen",
] as const;

const fallbackSubstitutions: IngredientSubstitution[] = [
  {
    match: "egg",
    options: [
      {
        label: "Unsweetened applesauce",
        amount: "1/4 cup per egg",
        note: "Best in brownies, muffins, and soft cakes.",
        dietary: ["vegan", "egg-free", "dairy-free"],
        reliable: true,
      },
      {
        label: "Flax egg",
        amount: "1 tbsp ground flax + 3 tbsp water",
        note: "Rest for ten minutes before using.",
        dietary: ["vegan", "egg-free", "dairy-free", "gluten-free"],
        reliable: true,
      },
      {
        label: "Hope and prayers",
        amount: "an emotionally generous amount",
        note: "This is the slot machine telling you to go to the store.",
        dietary: [],
        reliable: false,
      },
    ],
  },
  {
    match: "butter",
    options: [
      {
        label: "Plant butter",
        amount: "1:1 replacement",
        note: "Choose a firm baking block rather than a soft spread.",
        dietary: ["vegan", "dairy-free", "egg-free"],
        reliable: true,
      },
      {
        label: "Neutral oil",
        amount: "3/4 cup oil per 1 cup butter",
        note: "Works best in cakes; cookies will spread differently.",
        dietary: ["vegan", "dairy-free", "egg-free", "gluten-free"],
        reliable: true,
      },
      {
        label: "A motivational speech",
        amount: "two minutes, delivered firmly",
        note: "Beautiful effort. Still not butter.",
        dietary: [],
        reliable: false,
      },
    ],
  },
  {
    match: "milk",
    options: [
      {
        label: "Oat milk",
        amount: "1:1 replacement",
        note: "Full-fat oat milk gives the closest texture.",
        dietary: ["vegan", "dairy-free", "egg-free"],
        reliable: true,
      },
      {
        label: "Coconut milk",
        amount: "1:1 replacement",
        note: "Expect a gentle coconut note.",
        dietary: ["vegan", "dairy-free", "egg-free", "gluten-free"],
        reliable: true,
      },
    ],
  },
  {
    match: "flour",
    options: [
      {
        label: "1:1 gluten-free baking flour",
        amount: "1:1 replacement by weight",
        note: "Use a blend containing xanthan gum.",
        dietary: ["gluten-free", "vegetarian"],
        reliable: true,
      },
    ],
  },
  {
    match: "cream",
    options: [
      {
        label: "Coconut cream",
        amount: "1:1 replacement",
        note: "Chill before whipping and expect a coconut finish.",
        dietary: ["vegan", "dairy-free", "egg-free", "gluten-free"],
        reliable: true,
      },
    ],
  },
];

export function substitutionsFor(recipe: Recipe, ingredient: string) {
  const all = [...(recipe.substitutions || []), ...fallbackSubstitutions];
  return all.find((entry) =>
    ingredient.toLowerCase().includes(entry.match.toLowerCase()),
  )?.options || [];
}

export function filterSubstitutions(
  options: SubstitutionOption[],
  filters: DietaryTag[],
) {
  if (!filters.length) return options;
  return options.filter((option) =>
    filters.every((filter) => option.dietary.includes(filter)),
  );
}

export function absurdUnit(line: string) {
  const lower = line.toLowerCase();
  if (/(\d+\s*)?(cup|cups)/.test(lower)) {
    if (lower.includes("chocolate")) return "roughly 3 generous handfuls";
    if (lower.includes("flour")) return "one medium snowdrift of flour";
    if (lower.includes("sugar")) return "a teacup filled with bad decisions";
    return "one favorite mug, filled with confidence";
  }
  if (/\b(g|gram|grams)\b/.test(lower)) {
    return lower.includes("butter")
      ? "a butter brick about the weight of a sleepy phone"
      : "enough to make a kitchen scale feel useful";
  }
  if (/\b(tbsp|tablespoon)/.test(lower)) return "one assertive soup spoon";
  if (/\b(tsp|teaspoon)/.test(lower)) return "one tiny spoon, leveled-ish";
  if (/\begg/.test(lower)) return "one egg, emotionally available";
  if (lower.includes("salt")) return "a dramatic little pinch";
  return `${line} (measured with your heart, at your own risk)`;
}

export function pulseFeedback(enabled = true) {
  if (!enabled) return;
  navigator.vibrate?.(35);
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(480, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      220,
      context.currentTime + 0.08,
    );
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + 0.09,
    );
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
    oscillator.addEventListener("ended", () => context.close());
  } catch {
    // Audio feedback is optional and may be blocked by the browser.
  }
}
