import type { CSSProperties, ImgHTMLAttributes } from "react";
import { dessertHeroImage, dessertHeroSources, isDessertHeroImage } from "../lib/assets";
import { getImageFocus } from "../lib/recipe";
import type { Recipe } from "../types";

type RecipeImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  recipe?: Pick<Recipe, "image" | "imageFocus">;
  src?: string;
  sharedName?: string;
};

export function RecipeImage({
  recipe,
  src,
  sharedName,
  style,
  sizes = "(max-width: 620px) 100vw, 50vw",
  onError,
  ...props
}: RecipeImageProps) {
  const image = recipe?.image || src || dessertHeroImage;
  const focus = getImageFocus(recipe || {});
  const imageStyle = {
    "--image-zoom": focus.zoom,
    objectPosition: `${focus.x}% ${focus.y}%`,
    viewTransitionName: sharedName || "none",
    ...style,
  } as CSSProperties;

  const element = (
    <img
      {...props}
      src={image}
      sizes={sizes}
      style={imageStyle}
      onError={(event) => {
        if (!isDessertHeroImage(event.currentTarget.src)) {
          event.currentTarget.src = dessertHeroImage;
        }
        onError?.(event);
      }}
    />
  );

  if (!isDessertHeroImage(image)) return element;

  return (
    <picture>
      <source type="image/avif" srcSet={dessertHeroSources.avif} sizes={sizes} />
      <source type="image/webp" srcSet={dessertHeroSources.webp} sizes={sizes} />
      {element}
    </picture>
  );
}
