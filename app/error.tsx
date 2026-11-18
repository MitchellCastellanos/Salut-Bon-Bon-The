"use client";

export default function ErrorState({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="wrap section narrow" role="alert">
    <h1>Salut Bon Bon Thé<span>.</span></h1>
    <p>Cette page est momentanément indisponible. Réessayez dans un instant.</p>
    <p>This page is temporarily unavailable. Please try again in a moment.</p>
    <button className="button" onClick={reset}>Réessayer · Try again</button>
  </main>;
}
