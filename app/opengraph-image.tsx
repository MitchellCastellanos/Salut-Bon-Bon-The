import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Salut Bon Bon Thé";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social preview: the official logo when supplied, otherwise the brand name set in type. Never an invented mark. */
export default async function Image() {
  const logo = await readFile(join(process.cwd(), "public/brand/logo.svg")).then(file => `data:image/svg+xml;base64,${file.toString("base64")}`, () => undefined);
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#FFF8EF", color: "#4A2C1A", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", width: 1040, height: 14, background: "#F45143", borderRadius: 7, marginBottom: 56 }}/>
      {logo ? <img src={logo} height={220} alt=""/> : <div style={{ display: "flex", fontSize: 120, fontWeight: 800, color: "#F45143" }}>Salut Bon Bon Thé</div>}
      <div style={{ display: "flex", fontSize: 40, marginTop: 36 }}>Bubble tea · Thés aux fruits · Montréal</div>
      <div style={{ display: "flex", width: 1040, height: 14, background: "#F5B83D", borderRadius: 7, marginTop: 56 }}/>
    </div>, size);
}
