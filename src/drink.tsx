import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";

export function Drink({ flavor, hero = false, cover = false }: { flavor: string; hero?: boolean; cover?: boolean }) {
  const photo = cover ? "/drinks/hero.webp" : `/drinks/${flavor}.webp`;
  return <div className={`drink-scene ${flavor} ${hero ? "hero-drink" : ""}`} aria-hidden="true">
    <span className="bubble b1" /><span className="bubble b2" /><span className="bubble b3" />
    <div className="illustrated-cup"><i /><b /><span /><em /></div>
    {existsSync(join(process.cwd(), "public", photo)) && <Image src={photo} alt="" fill sizes={hero ? "(max-width: 720px) 100vw, 50vw" : "(max-width: 720px) 45vw, 280px"} />}
  </div>;
}
