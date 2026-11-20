// Finds how large the official logo can be inside the card QR while the code still decodes under degradation.
// Usage: node scripts/qr-logo-calibrate.mjs [payload]   (decoding with jsQR on rasterized images; real phones still need testing)
import { readFileSync } from "node:fs";
import sharp from "sharp";
import jsQR from "jsqr";
import { brandedQr } from "../src/qr-logo.ts";

const logoSvg = readFileSync(new URL("../public/brand/logo.svg", import.meta.url), "utf8");
const payload = process.argv[2] ?? "https://salut-bon-bon-the.vercel.app/s/ABCDEFGHJKLMNPQRSTUVWX";
const sizes = [160, 240, 480];
const blurs = [0, 0.8, 1.2];
const rotations = [0, 15, 45];

async function decodes(svg, width, blur, rotation) {
  let image = sharp(Buffer.from(svg), { density: 300 }).resize(width, width, { kernel: "lanczos3" }).flatten({ background: "#fff" });
  if (rotation) image = sharp(await image.png().toBuffer()).rotate(rotation, { background: "#fff" }).extend({ top: 20, bottom: 20, left: 20, right: 20, background: "#fff" });
  if (blur) image = image.blur(blur);
  const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);
  return result?.data === payload;
}

const rows = [];
for (let ratio = 0.1; ratio <= 0.5001; ratio += 0.02) {
  const { svg, version, logoAreaShare } = brandedQr(payload, { logoSvg, heightRatio: ratio });
  let ok = 0, total = 0;
  for (const width of sizes) for (const blur of blurs) for (const rotation of rotations) { total++; if (await decodes(svg, width, blur, rotation)) ok++; }
  rows.push({ ratio: +ratio.toFixed(2), version, plateShare: +(logoAreaShare * 100).toFixed(1), decoded: `${ok}/${total}`, rate: ok / total });
}
console.table(rows);
const best = rows.filter(r => r.rate === 1).at(-1);
console.log(best ? `Largest ratio decoding in every variant: ${best.ratio} (plate ${best.plateShare}% of the symbol area). Use a safety margin below it.` : "No ratio decoded in every variant.");
