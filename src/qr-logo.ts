import QRCode from "qrcode";

/**
 * Card QR with the official logo centered. Error correction level H, a 4-module quiet zone, dark-on-light high contrast, and a light
 * plate under the logo aligned to the module grid (the modules under the plate are not drawn). The logo keeps its natural aspect ratio.
 * `qrLogoHeightRatio` was chosen by decoding tests (`npm run qr:calibrate`), not by a fixed rule, and still needs real-phone confirmation.
 */
export const qrLogoHeightRatio = 0.28;
const quiet = 4;

function parseLogo(svg: string) {
  const open = svg.match(/<svg\b[^>]*>/i)?.[0];
  const viewBox = open?.match(/viewBox="([\d.\s-]+)"/)?.[1]?.trim().split(/\s+/).map(Number);
  if (!open || !viewBox || viewBox.length !== 4 || viewBox.some(Number.isNaN)) return undefined;
  const inner = svg.slice(svg.indexOf(open) + open.length, svg.lastIndexOf("</svg>")).replace(/<title[\s\S]*?<\/title>/gi, "");
  return { viewBox: viewBox.join(" "), width: viewBox[2], height: viewBox[3], inner };
}

export type BrandedQr = { svg: string; version: number; modules: number; logoAreaShare: number };

export function brandedQr(text: string, options: { logoSvg?: string; heightRatio?: number; dark?: string; light?: string; title?: string } = {}): BrandedQr {
  const qr = QRCode.create(text, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const dark = options.dark ?? "#2C0F08", light = options.light ?? "#FFFFFF";
  const logo = options.logoSvg ? parseLogo(options.logoSvg) : undefined;
  const total = n + quiet * 2;
  let plate: { x: number; y: number; w: number; h: number } | undefined;
  let logoBox: { x: number; y: number; w: number; h: number } | undefined;
  if (logo) {
    const ratio = options.heightRatio ?? qrLogoHeightRatio;
    const logoH = ratio * n, logoW = logoH * logo.width / logo.height, pad = 1.2;
    // Plate edges snap outward to whole modules, symmetric around the center, so no module is cut in half.
    const half = (value: number) => Math.ceil((value + pad * 2) / 2 - 1e-9);
    const hw = half(logoW), hh = half(logoH), c = n / 2;
    const x0 = Math.floor(c - hw + 1e-9), y0 = Math.floor(c - hh + 1e-9);
    plate = { x: x0, y: y0, w: n - 2 * x0, h: n - 2 * y0 };
    logoBox = { x: c - logoW / 2, y: c - logoH / 2, w: logoW, h: logoH };
  }
  const inPlate = (r: number, col: number) => plate && col >= plate.x && col < plate.x + plate.w && r >= plate.y && r < plate.y + plate.h;
  let path = "";
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (qr.modules.get(r, c) && !inPlate(r, c)) {
        const start = c;
        while (c < n && qr.modules.get(r, c) && !inPlate(r, c)) c++;
        path += `M${start + quiet} ${r + quiet}h${c - start}v1h${-(c - start)}z`;
      } else c++;
    }
  }
  const title = options.title ? `<title>${options.title.replace(/[<>&"]/g, "")}</title>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img">${title}`
    + `<rect width="${total}" height="${total}" fill="${light}"/><path d="${path}" fill="${dark}"/>`
    + (logo && logoBox ? `<svg x="${logoBox.x + quiet}" y="${logoBox.y + quiet}" width="${logoBox.w}" height="${logoBox.h}" viewBox="${logo.viewBox}" preserveAspectRatio="xMidYMid meet" shape-rendering="geometricPrecision">${logo.inner}</svg>` : "")
    + `</svg>`;
  return { svg, version: qr.version, modules: n, logoAreaShare: plate ? (plate.w * plate.h) / (n * n) : 0 };
}
