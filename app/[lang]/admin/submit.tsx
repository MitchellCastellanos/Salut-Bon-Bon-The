"use client";

import { useFormStatus } from "react-dom";

/** Submit button for admin forms: shows that the change is being saved, blocks double clicks, and asks for confirmation on risky actions. */
export function Submit({ children, pending = "Saving…", confirm, className = "button", name, value }: {
  children: React.ReactNode; pending?: string; confirm?: string; className?: string; name?: string; value?: string;
}) {
  const { pending: busy } = useFormStatus();
  return <button className={className} name={name} value={value} disabled={busy} aria-busy={busy}
    onClick={confirm ? event => { if (!window.confirm(confirm)) event.preventDefault(); } : undefined}>{busy ? pending : children}</button>;
}
