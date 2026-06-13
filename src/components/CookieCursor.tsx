import { useEffect, useRef } from "react";
import { useExperienceStore } from "../store/useExperienceStore";

export function CookieCursor() {
  const cursorRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const enabled = useExperienceStore(
    (state) => state.comfort.cursorEffects && !state.comfort.reducedIntensity,
  );

  useEffect(() => {
    const cursor = cursorRef.current;
    const trail = trailRef.current;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    if (!cursor || !trail || !enabled || !finePointer) return;

    document.body.classList.add("has-cookie-cursor");
    let previous = { x: window.innerWidth / 2, y: window.innerHeight / 2, at: 0 };
    let particleCooldown = 0;

    const onMove = (event: PointerEvent) => {
      cursor.classList.remove("is-hidden");
      cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) rotate(${Math.min(22, event.movementX * 1.4)}deg)`;
      const now = performance.now();
      const distance = Math.hypot(
        event.clientX - previous.x,
        event.clientY - previous.y,
      );
      const elapsed = Math.max(8, now - previous.at);
      const speed = distance / elapsed;

      if (speed > 0.65 && now > particleCooldown) {
        particleCooldown = now + 22;
        const particle = document.createElement("i");
        const sugar = Math.random() > 0.68;
        particle.className = sugar ? "cursor-sprinkle is-sugar" : "cursor-sprinkle";
        particle.style.left = `${event.clientX + (Math.random() - 0.5) * 12}px`;
        particle.style.top = `${event.clientY + 9 + Math.random() * 9}px`;
        particle.style.setProperty("--trail-x", `${(Math.random() - 0.5) * 30}px`);
        particle.style.setProperty("--trail-y", `${16 + Math.random() * 24}px`);
        trail.appendChild(particle);
        window.setTimeout(() => particle.remove(), 720);
      }

      previous = { x: event.clientX, y: event.clientY, at: now };
    };

    const onLeave = () => cursor.classList.add("is-hidden");
    const onEnter = () => cursor.classList.remove("is-hidden");
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onLeave);
    document.documentElement.addEventListener("mouseenter", onEnter);

    return () => {
      document.body.classList.remove("has-cookie-cursor");
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
      document.documentElement.removeEventListener("mouseenter", onEnter);
      trail.replaceChildren();
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div className="cookie-cursor is-hidden" ref={cursorRef} aria-hidden="true">
        <svg viewBox="0 0 42 42">
          <path
            className="cookie-dough"
            d="M35.7 19.2a6.2 6.2 0 0 1-5.4-9.3A17.2 17.2 0 1 0 38 24.1a6.1 6.1 0 0 1-2.3-4.9Z"
          />
          <circle cx="13" cy="14" r="2.4" />
          <circle cx="23.4" cy="25.8" r="2.8" />
          <circle cx="12.8" cy="29.4" r="2" />
          <circle cx="25.8" cy="13.8" r="1.8" />
          <circle cx="31.2" cy="31" r="1.6" />
        </svg>
      </div>
      <div className="cursor-trail-layer" ref={trailRef} aria-hidden="true" />
    </>
  );
}
