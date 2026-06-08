import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";

const StudioPage = lazy(() =>
  import("./pages/StudioPage").then((module) => ({
    default: module.StudioPage,
  })),
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/studio"
          element={
            <Suspense fallback={<div className="route-loader">Opening the studio...</div>}>
              <StudioPage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
