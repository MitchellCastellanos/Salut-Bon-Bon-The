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
  return <section id="promotions" className="campaign" aria-label="Promotions">
    <div className="campaign-stage" onTouchStart={event => { start.current = event.touches[0].clientX; }}
      onTouchEnd={event => {
        if (start.current === null) return;
        const delta = event.changedTouches[0].clientX - start.current;
        if (Math.abs(delta) > 45) move(delta > 0 ? -1 : 1);
        start.current = null;
      }}>
      {slides[active].scene}
    </div>
    <button className="campaign-arrow prev" type="button" onClick={() => move(-1)} aria-label={fr ? "Boisson précédente" : "Previous drink"}>‹</button>
    <button className="campaign-arrow next" type="button" onClick={() => move(1)} aria-label={fr ? "Boisson suivante" : "Next drink"}>›</button>
    <div className="campaign-dots">
      {slides.map((slide, index) => <button type="button" key={slide.title} aria-label={slide.title} aria-pressed={index === active} onClick={() => setActive(index)}/>)}
    </div>
    <span className="sr-only" aria-live="polite">{slides[active].title}</span>
  </section>;
}
