import Link from "next/link";

/** Page title, one-sentence purpose and optional action, identical on every admin screen. */
export function PageHeader({ title, intro, action }: { title: string; intro?: React.ReactNode; action?: React.ReactNode }) {
  return <header className="admin-head"><div><h1>{title}</h1>{intro && <p className="admin-intro">{intro}</p>}</div>{action && <div className="admin-head-action">{action}</div>}</header>;
}

/** Result of the last action: green when it saved, red when it did not. Read from ?saved= / ?error= so it survives the redirect. */
export function Notice({ saved, error, saves = {}, errors = {} }: { saved?: string | string[]; error?: string | string[]; saves?: Record<string, string>; errors?: Record<string, string> }) {
  const s = typeof saved === "string" ? saved : "", e = typeof error === "string" ? error : "";
  return <>
    {s && <p role="status" className="notice notice-good">{saves[s] ?? "Saved. The change is live."}</p>}
    {e && <p role="alert" className="notice notice-bad">{errors[e] ?? "That could not be saved. Check the highlighted values and try again."}</p>}
  </>;
}

export function Badge({ tone = "neutral", children }: { tone?: "good" | "warn" | "bad" | "neutral"; children: React.ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function Stat({ label, value, note, href }: { label: string; value: React.ReactNode; note?: React.ReactNode; href?: string }) {
  const body = <><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</>;
  return href ? <Link className="panel stat" href={href}>{body}</Link> : <div className="panel stat">{body}</div>;
}

/** Tells the owner where a setting lives and whether it changes what customers see right now. */
export function LiveNote({ children = "Changes here appear on the website immediately." }: { children?: React.ReactNode }) {
  return <p className="admin-live"><span aria-hidden="true">●</span> {children}</p>;
}

export const money = (cents: number) => new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100);
export const dollars = (cents: number | null) => cents === null ? "" : (cents / 100).toFixed(2);
