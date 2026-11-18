"use client";
import { useRef, useState, type ReactNode } from "react";
import type { Lang } from "./domain";

export function HeroGallery({ lang, slides }: { lang: Lang; slides: { title: string; scene: ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const start = useRef<number | null>(null);
  const fr = lang === "fr";
  function move(direction: number) {
    setActive(previous => (previous + direction + slides.length) % slides.length);
  }
  return <div className="gallery" aria-label={fr ? "Boissons en vedette" : "Featured drinks"} role="region">
    <div onTouchStart={event => { start.current = event.touches[0].clientX; }} onTouchEnd={event => {
      if (start.current === null) return;
      const delta = event.changedTouches[0].clientX - start.current;
      if (Math.abs(delta) > 45) move(delta > 0 ? -1 : 1);
      start.current = null;
    }}>{slides[active].scene}</div>
    <div className="gallery-controls">
      <button type="button" onClick={() => move(-1)} aria-label={fr ? "Boisson précédente" : "Previous drink"}>←</button>
      <span aria-live="polite">{slides[active].title}</span>
      <button type="button" onClick={() => move(1)} aria-label={fr ? "Boisson suivante" : "Next drink"}>→</button>
    </div>
  </div>;
}
