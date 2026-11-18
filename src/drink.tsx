import { StorefrontArt } from "./storefront-art";

export function Drink({ flavor, illustrated = false }: { flavor: string; illustrated?: boolean }) {
  const illustration = <>
    <span className="bubble b1" /><span className="bubble b2" /><span className="bubble b3" />
    <div className="illustrated-cup"><i /><b /><span /><em /></div>
  </>;
  return <div className={`drink-scene ${flavor}`} aria-hidden="true">
    {illustrated ? illustration : <StorefrontArt path={`/drinks/${flavor}.webp`} sizes="(max-width: 720px) 48vw, 280px">
      {illustration}
    </StorefrontArt>}
  </div>;
}
