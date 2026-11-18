import { statSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";

export function hasPublicImage(path: string) {
  return /^\/[a-z0-9/_-]+\.(webp|svg)$/i.test(path) &&
    Boolean(statSync(join(process.cwd(), "public", path), { throwIfNoEntry: false })?.isFile());
}

export function StorefrontArt({ path, sizes, children, priority = false, alt = "" }: {
  path: string; sizes: string; children?: React.ReactNode; priority?: boolean; alt?: string;
}) {
  return hasPublicImage(path) ? <Image src={path} alt={alt} fill sizes={sizes} preload={priority}/> : children;
}

const cup = <><path d="M8 13h32l-4 29H12Z"/><path d="M6 13h36M26 13l5-8h7"/><circle cx="18" cy="32" r="2"/><circle cx="27" cy="36" r="2"/><circle cx="32" cy="28" r="2"/></>;
const drawings = {
  milk: cup,
  fruit: <>{cup}<path d="M32 18q12-3 13 8q-10 2-13-8Z"/></>,
  smoothie: <><path d="M12 17h24l-3 25H15ZM10 17c0-15 28-15 28 0M24 17l3-12h7"/><path d="M20 26h8m-7 7h6"/></>,
  lemonade: <><path d="M10 15h27l-3 26H14ZM16 26h17M22 15l3-9h8"/><path d="M35 16a7 7 0 1 0-7-7"/></>,
  matcha: <><path d="M7 24h34q-3 16-17 16T7 24Zm23 0 7-16 4 2-6 14"/><path d="M14 30h19"/></>,
  pearls: <><ellipse cx="24" cy="32" rx="18" ry="8"/><circle cx="15" cy="23" r="5"/><circle cx="26" cy="18" r="6"/><circle cx="34" cy="25" r="5"/><circle cx="24" cy="29" r="4"/></>,
  jelly: <><path d="m18 8 8-4 8 4v10l-8 4-8-4Zm0 0 8 5 8-5m-8 5v9M5 26l8-5 8 5v10l-8 5-8-5Zm0 0 8 5 8-5m-8 5v10m13-15 8-5 8 5v10l-8 5-8-5Zm0 0 8 5 8-5m-8 5v10"/></>,
  account: <><circle cx="24" cy="15" r="7"/><path d="M10 42v-5a14 14 0 0 1 28 0v5"/></>,
  bag: <><path d="M10 17h28l3 26H7Zm8 2v-7a6 6 0 0 1 12 0v7"/></>,
  gift: <><path d="M8 22h32v20H8Zm-3-9h38v9H5Zm19 0v29"/><path d="M24 13C11 14 10 3 17 4c5 1 7 9 7 9Zm0 0c13 1 14-10 7-9-5 1-7 9-7 9Z"/></>,
  instagram: <><rect x="7" y="7" width="34" height="34" rx="9"/><circle cx="24" cy="24" r="8"/><circle cx="34" cy="14" r="1"/></>,
} as const;

export function StorefrontIcon({ name }: { name: keyof typeof drawings }) {
  return <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{drawings[name]}</svg>;
}
