import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { DistractionLoader } from "../components/DistractionLoader";

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-copy">
        <span>404 / Missing from the cooling rack</span>
        <h1>
          Loco for Coco?
          <em>More like Lost for Coco.</em>
        </h1>
        <p>
          This recipe is gone. We checked behind the flour, under the tea towel,
          and inside the suspiciously empty cake tin.
        </p>
        <Link className="primary-button" to="/">
          <ArrowLeft size={18} />
          Back to the archive
        </Link>
      </div>
      <DistractionLoader
        variant="lost"
        label="The cake did not stick the landing."
      />
    </main>
  );
}
