// Reports which manifest images exist in public/. Exit code 1 only with --strict.
import { readFile, stat } from "node:fs/promises";
const manifest = JSON.parse(await readFile(new URL("../docs/image-manifest.json", import.meta.url), "utf8"));
let missing = 0;
for (const asset of manifest) {
  const present = await stat(new URL(`../${asset.file}`, import.meta.url)).then(s => s.isFile(), () => false);
  if (!present) missing++;
  console.log(`${present ? "present" : "MISSING"}  ${asset.id.padEnd(26)} ${asset.file}  [${asset.batch}]`);
}
console.log(`\n${manifest.length - missing}/${manifest.length} present`);
if (missing && process.argv.includes("--strict")) process.exit(1);
