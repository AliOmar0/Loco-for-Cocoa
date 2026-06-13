import { lazy, Suspense } from "react";

const ThreeDessert = lazy(() =>
  import("./ThreeDessert").then((module) => ({ default: module.ThreeDessert })),
);

export function DistractionLoader({
  label = "Tempering the pixels...",
  variant = "bean",
}: {
  label?: string;
  variant?: "bean" | "lost";
}) {
  return (
    <div className={`distraction-loader is-${variant}`} role="status">
      <Suspense fallback={<div className="dessert-loader-fallback" />}>
        <ThreeDessert variant={variant} />
      </Suspense>
      <div>
        <span>{variant === "bean" ? "Flick the cocoa bean" : "A small kitchen incident"}</span>
        <strong>{label}</strong>
      </div>
    </div>
  );
}
