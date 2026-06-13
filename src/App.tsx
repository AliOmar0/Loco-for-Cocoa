import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ComfortMenu } from "./components/ComfortMenu";
import { DistractionLoader } from "./components/DistractionLoader";
import { CookieCursor } from "./components/CookieCursor";
import { backendConfigured, getPublicArchive } from "./lib/backend";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RecipePage } from "./pages/RecipePage";
import { useRecipeStore } from "./store/useRecipeStore";

const StudioPage = lazy(() =>
  import("./pages/StudioPage").then((module) => ({
    default: module.StudioPage,
  })),
);

export default function App() {
  const [archiveReady, setArchiveReady] = useState(!backendConfigured);
  const replaceRecipes = useRecipeStore((state) => state.replaceRecipes);
  const replaceCollections = useRecipeStore(
    (state) => state.replaceCollections,
  );

  useEffect(() => {
    if (!backendConfigured) return;
    let cancelled = false;
    getPublicArchive()
      .then((archive) => {
        if (cancelled || !archive.initialized) return;
        replaceRecipes(archive.recipes);
        replaceCollections(archive.collections);
      })
      .catch((error) => {
        console.error("Unable to refresh the public recipe archive:", error);
      })
      .finally(() => {
        if (!cancelled) setArchiveReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [replaceCollections, replaceRecipes]);

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <CookieCursor />
      <ComfortMenu />
      <Suspense
        fallback={
          <DistractionLoader label="Opening a very organized counter..." />
        }
      >
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/recipes/:recipeId"
            element={<RecipePage archiveReady={archiveReady} />}
          />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
