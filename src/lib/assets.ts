const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;

export const dessertHeroImage = asset("dessert-hero-1440.webp");

export const dessertHeroSources = {
  avif: [640, 960, 1440]
    .map((width) => `${asset(`dessert-hero-${width}.avif`)} ${width}w`)
    .join(", "),
  webp: [640, 960, 1440]
    .map((width) => `${asset(`dessert-hero-${width}.webp`)} ${width}w`)
    .join(", "),
};

export function isDessertHeroImage(src: string) {
  return src.includes("dessert-hero");
}
