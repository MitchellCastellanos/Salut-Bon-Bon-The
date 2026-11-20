import { readdir } from "node:fs/promises";
import { join } from "node:path";

/** Photos the website can show: the WebP files shipped in /public. New photos are added by the web team through the image workflow, then appear here. */
export async function availableImages(): Promise<string[]> {
  const found: string[] = [];
  for (const folder of ["catalog", "drinks", "promotions"]) {
    try {
      for (const name of await readdir(join(process.cwd(), "public", folder))) if (/^[A-Za-z0-9_-]+\.webp$/.test(name)) found.push(`/${folder}/${name}`);
    } catch { /* folder missing in this deployment */ }
  }
  return found.sort();
}
