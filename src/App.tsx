import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ComfortMenu } from "./components/ComfortMenu";
import { DistractionLoader } from "./components/DistractionLoader";
import { CookieCursor } from "./components/CookieCursor";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";

const StudioPage = lazy(() =>
  import("./pages/StudioPage").then((module) => ({
    default: module.StudioPage,
  })),
);

export default function App() {
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
          <Route path="/studio" element={<StudioPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
