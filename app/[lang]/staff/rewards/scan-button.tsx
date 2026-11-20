"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

type Detector = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (options: { formats: string[] }) => Detector;

/**
 * In-page camera scanner for the customer's QR card. Uses the native BarcodeDetector when the browser has it (Chrome/Android)
 * and falls back to jsQR on a canvas everywhere else (iOS Safari, Firefox, desktop). Needs HTTPS (or localhost) for camera access.
 */
export function ScanButton({ inputId, label, unsupported }: { inputId: string; label: string; unsupported: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [active, setActive] = useState(false);
  const [note, setNote] = useState("");

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    setActive(false);
  }, []);

  useEffect(() => stop, [stop]);

  async function start() {
    if (stream.current) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setNote(unsupported); return; }
    setNote("");
    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setNote(denied ? "Camera access was blocked. Allow the camera for this site in the browser settings, then try again." : unsupported);
      return;
    }
    stream.current = media;
    setActive(true);
    // The <video> is rendered by the state change above; wait one frame so the ref exists.
    await new Promise(resolve => requestAnimationFrame(resolve));
    const element = video.current;
    if (!element || stream.current !== media) { media.getTracks().forEach(track => track.stop()); return; }
    element.srcObject = media;
    await element.play().catch(() => undefined);

    const Native = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
    const detector = Native ? new Native({ formats: ["qr_code"] }) : undefined;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const read = async (): Promise<string | undefined> => {
      if (detector) {
        const found = await detector.detect(element).catch(() => []);
        if (found[0]) return found[0].rawValue;
      }
      if (!context || !element.videoWidth) return undefined;
      // Downscale large frames: jsQR cost grows with pixels and 640px wide is plenty for a card QR.
      const scale = Math.min(1, 640 / element.videoWidth);
      canvas.width = Math.round(element.videoWidth * scale);
      canvas.height = Math.round(element.videoHeight * scale);
      context.drawImage(element, 0, 0, canvas.width, canvas.height);
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" })?.data;
    };

    const tick = async () => {
      if (stream.current !== media) return;
      const value = await read();
      if (stream.current !== media) return;
      if (value) {
        const input = document.getElementById(inputId) as HTMLInputElement | null;
        stop();
        if (input) { input.value = value; input.form?.requestSubmit(); }
        return;
      }
      timer.current = setTimeout(tick, 200);
    };
    tick();
  }

  return <div>
    <button type="button" className="outline" onClick={active ? stop : start}>{active ? "Stop camera" : label}</button>
    {active && <video ref={video} playsInline muted aria-label="Camera preview: point it at the customer's QR code" style={{ width: "100%", maxWidth: 360, borderRadius: 12, marginTop: 8 }}/>}
    {note && <p role="status" className="fine-print">{note}</p>}
  </div>;
}
