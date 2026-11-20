import { demoMode } from "./demo-mode";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { emailMode } from "./notifications";
import { emailLogoUrl } from "./brand-server";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type AccountEmailKind = "verify" | "reset";

export function accountEmail(kind: AccountEmailKind, name: string, token: string, site: string) {
  const link = (lang: "fr" | "en") => new URL(`/${lang}/account/${kind === "verify" ? "verify" : "reset"}?token=${encodeURIComponent(token)}`, site).href;
  const first = name.trim().split(/\s+/)[0] || "";
  const copy = kind === "verify" ? {
    subject: "Confirmez votre courriel · Confirm your email",
    fr: [`Bonjour ${first},`, "Confirmez votre courriel pour activer votre compte Salut Bon Bon Thé et Récompenses Salut.", "Confirmer mon courriel", "Ce lien expire dans 1 heure. Si vous n’avez pas créé de compte, ignorez ce message."],
    en: [`Hello ${first},`, "Confirm your email to activate your Salut Bon Bon Thé account and Salut Rewards.", "Confirm my email", "This link expires in 1 hour. If you did not create an account, ignore this message."],
  } : {
    subject: "Réinitialisation du mot de passe · Password reset",
    fr: [`Bonjour ${first},`, "Nous avons reçu une demande de réinitialisation de votre mot de passe.", "Choisir un nouveau mot de passe", "Ce lien expire dans 1 heure. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message."],
    en: [`Hello ${first},`, "We received a request to reset your password.", "Choose a new password", "This link expires in 1 hour. If you did not request this, ignore this message."],
  };
  const logo = emailLogoUrl(site);
  const block = (lang: "fr" | "en") => `<p>${escapeHtml(copy[lang][0])}</p><p>${escapeHtml(copy[lang][1])}</p>
<p><a href="${escapeHtml(link(lang))}" style="display:inline-block;background:#F5B83D;color:#4A2C1A;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(copy[lang][2])}</a></p>
<p style="font-size:12px">${escapeHtml(copy[lang][3])}</p>`;
  const html = `<!doctype html><html><body style="margin:0;background:#FFF8EF;font-family:Arial,Helvetica,sans-serif;color:#4A2C1A"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden"><tr><td style="background:#F45143;color:#fff;padding:24px 28px;font-size:22px;font-weight:bold">${logo ? `<img src="${escapeHtml(logo)}" alt="Salut Bon Bon Thé" height="40">` : "Salut Bon Bon Thé"}</td></tr>
<tr><td style="padding:28px">${block("fr")}<hr style="border:none;border-top:1px solid #eee;margin:24px 0">${block("en")}</td></tr></table></td></tr></table></body></html>`;
  const text = `${copy.fr.slice(0, 3).join("\n")}\n${link("fr")}\n\n${copy.en.slice(0, 3).join("\n")}\n${link("en")}`;
  return { subject: copy.subject, html, text };
}

/** Account email is transactional. It honours the same test/live gates as order email. */
export async function sendAccountEmail(kind: AccountEmailKind, to: string, name: string, token: string) {
  const site = process.env.SITE_URL || process.env.BETTER_AUTH_URL || "";
  if (!site) throw new Error("SITE_URL is required to send account email");
  const message = accountEmail(kind, name, token, site);
  const deployed = process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  if (process.env.SALUT_EMAIL_CAPTURE_DIR && !deployed) {
    await mkdir(process.env.SALUT_EMAIL_CAPTURE_DIR, { recursive: true });
    await writeFile(join(process.env.SALUT_EMAIL_CAPTURE_DIR, `${kind}-${Date.now()}.json`), JSON.stringify({ to, ...message }));
    return;
  }
  const mode = emailMode();
  if (mode === "disabled") return;
  if (mode === "test" && to !== process.env.RESEND_TEST_RECIPIENT) return;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.RESEND_FROM, to: [to], ...message }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
}

/**
 * With SALUT_INSTANT_ACCOUNTS=1 (or demo mode, SALUT_DEMO_MODE=1) a new customer is marked verified at sign-up, with no email, so the customer journey can be shown
 * before a mail provider is configured. It is honoured in every environment, including production, because setting the variable is
 * the explicit decision: while it is on, anyone can register an address they do not own. Remove it once Resend is configured.
 */
export function instantAccounts() {
  return process.env.SALUT_INSTANT_ACCOUNTS === "1" || demoMode();
}

/** Registration is only offered when verification email can actually be delivered (or captured in non-deployed testing). */
export function accountEmailAvailable() {
  const deployed = process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview";
  return instantAccounts() || Boolean((process.env.SALUT_EMAIL_CAPTURE_DIR && !deployed) || emailMode() !== "disabled");
}
