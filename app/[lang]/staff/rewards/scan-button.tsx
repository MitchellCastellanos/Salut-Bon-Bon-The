"use client";

import { useRef, useState } from "react";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };

/** Camera scanner for browsers with the BarcodeDetector API. Elsewhere (iOS Safari) staff scan with the phone camera app, an external scanner, or paste. */
export function ScanButton({ inputId, label, unsupported }: { inputId: string; label: string; unsupported: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [note, setNote] = useState("");
  async function start() {
    const Ctor = (globalThis as unknown as { BarcodeDetector?: new (options: { formats: string[] }) => Detector }).BarcodeDetector;
    if (!Ctor || !navigator.mediaDevices?.getUserMedia) { setNote(unsupported); return; }
    setNote(""); setActive(true);
    const detector = new Ctor({ formats: ["qr_code"] });
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).catch(() => undefined);
    if (!stream || !video.current) { setActive(false); setNote(unsupported); return; }
    video.current.srcObject = stream;
    await video.current.play();
    const stop = () => { stream.getTracks().forEach(track => track.stop()); setActive(false); };
    const tick = async () => {
      if (!video.current || !stream.active) return;
      const found = await detector.detect(video.current).catch(() => []);
      if (found[0]) {
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        if (input) { input.value = found[0].rawValue; stop(); input.form?.requestSubmit(); }
        return;
      }
      setTimeout(tick, 250);
    };
    tick();
  }
  return <div>
    <button type="button" className="outline" onClick={start}>{label}</button>
    {active && <video ref={video} playsInline muted style={{ width: "100%", maxWidth: 360, borderRadius: 12, marginTop: 8 }}/>}
    {note && <p role="status" className="fine-print">{note}</p>}
  </div>;
}
