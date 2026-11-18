import { statSync } from "node:fs";
import { join } from "node:path";

const exists = (path: string) => Boolean(statSync(join(process.cwd(), "public", path), { throwIfNoEntry: false })?.isFile());

export const officialLogo = () => exists("brand/logo.svg") ? "/brand/logo.svg" : undefined;
/** Email clients reject SVG. The owner supplies a PNG export of the same official logo. */
export function emailLogoUrl(site: string) {
  return site && exists("brand/logo-email.png") ? new URL("/brand/logo-email.png", site).href : undefined;
}
