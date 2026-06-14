import ingredientCsv from "./epicure-ingredients.csv?raw";

export type EpicureIngredient = {
  id: number;
  name: string;
  label: string;
  category: string;
  vegetarian: boolean;
  vegan: boolean;
};

function ingredientLabel(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export const epicureIngredients: EpicureIngredient[] = ingredientCsv
  .trim()
  .split(/\r?\n/)
  .slice(1)
  .map((line) => {
    const [id, name, , primaryCategory, vegetarian, vegan] = line.split(",");
    return {
      id: Number(id),
      name,
      label: ingredientLabel(name),
      category: primaryCategory || "Pantry",
      vegetarian: vegetarian === "True",
      vegan: vegan === "True",
    };
  })
  .filter((ingredient) => ingredient.id && ingredient.name);

export const epicureIngredientCategories = [
  "All",
  ...Array.from(
    new Set(epicureIngredients.map((ingredient) => ingredient.category)),
  ).sort(),
];

