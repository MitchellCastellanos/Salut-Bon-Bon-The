// Renders the Apple Wallet image set from the official logo (public/brand/logo.svg) into assets/wallet/. Run once after the logo changes.
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../public/brand/logo.svg", import.meta.url));
const out = new URL("../assets/wallet/", import.meta.url);
await mkdir(out, { recursive: true });
const cream = { r: 255, g: 248, b: 239, alpha: 1 };

async function fit(name, width, height, { background, padding = 0 }) {
  const inner = await sharp(svg, { density: 600 }).resize({ width: width - padding * 2, height: height - padding * 2, fit: "inside" }).png().toBuffer();
  let image = sharp({ create: { width, height, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: inner, gravity: "centre" }]);
  await image.png().toFile(new URL(name, out).pathname);
}
// Required icon (the notification and lock-screen glyph), cream plate.
for (const [name, size] of [["icon.png", 29], ["icon@2x.png", 58], ["icon@3x.png", 87]]) await fit(name, size, size, { background: cream, padding: Math.round(size * 0.08) });
// Header logo, at most 160 x 50 points.
for (const [name, scale] of [["logo.png", 1], ["logo@2x.png", 2], ["logo@3x.png", 3]]) await fit(name, 160 * scale, 50 * scale, { padding: 2 * scale });
console.log("Wrote assets/wallet/*.png from public/brand/logo.svg");
