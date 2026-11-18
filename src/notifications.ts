import { database } from "./db";
import { money, pickupDate, type Lang } from "./domain";

type Db = { query<T extends Record<string, unknown>>(sql: string, args?: unknown[]): Promise<{ rows: T[] }> };
export type EmailKind = "customer_confirmation" | "store_notification" | "ready" | "cancelled";

type OrderRow = {
  number: string; customer: string; locale: Lang; pickup_at: Date | string; total: number; tax_cents: number;
  payment: string; tracking_token: string;
  items: { name: { fr: string; en: string }; quantity: number; subtotal: number; size?: string }[];
};

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const palette = { cream: "#FFF8EF", coral: "#F45143", mango: "#F5B83D", brown: "#4A2C1A" };

const copy = {
  fr: {
    customer_confirmation: (n: string) => ({ subject: `Commande n° ${n} reçue`, heading: "Merci, votre commande est reçue !", lead: "Nous la préparons avec soin. Voici le résumé." }),
    store_notification: (n: string) => ({ subject: `Nouvelle commande n° ${n}`, heading: "Nouvelle commande à préparer", lead: "Une commande vient d’être reçue." }),
    ready: (n: string) => ({ subject: `Commande n° ${n} prête pour la cueillette`, heading: "Votre commande est prête !", lead: "Elle vous attend au comptoir." }),
    cancelled: (n: string) => ({ subject: `Commande n° ${n} annulée`, heading: "Votre commande a été annulée", lead: "Si vous avez payé en ligne, communiquez avec nous pour un remboursement." }),
    labels: { pickup: "Cueillette", tax: "Taxes", total: "Total", track: "Suivre ma commande", payment: { PAID_ONLINE: "Payée en ligne", UNPAID: "À payer à la cueillette", PAID_AT_PICKUP: "Payée à la cueillette" } as Record<string, string>, sign: "Salut Bon Bon Thé · Montréal" },
  },
  en: {
    customer_confirmation: (n: string) => ({ subject: `Order #${n} received`, heading: "Thank you, we have your order!", lead: "We are preparing it with care. Here is your summary." }),
    store_notification: (n: string) => ({ subject: `New order #${n}`, heading: "New order to prepare", lead: "An order was just received." }),
    ready: (n: string) => ({ subject: `Order #${n} ready for pickup`, heading: "Your order is ready!", lead: "It is waiting for you at the counter." }),
    cancelled: (n: string) => ({ subject: `Order #${n} cancelled`, heading: "Your order was cancelled", lead: "If you paid online, contact us about a refund." }),
    labels: { pickup: "Pickup", tax: "Taxes", total: "Total", track: "Track my order", payment: { PAID_ONLINE: "Paid online", UNPAID: "Pay at pickup", PAID_AT_PICKUP: "Paid at pickup" } as Record<string, string>, sign: "Salut Bon Bon Thé · Montréal" },
  },
} as const;

export function orderEmail(kind: EmailKind, order: OrderRow, lang: Lang, siteUrl = process.env.SITE_URL ?? "") {
  if (!/^\d+$/.test(String(order.number))) throw new Error("Invalid order number");
  const text = copy[lang];
  const head = text[kind](String(order.number));
  const lines = order.items.map(item => `${item.quantity} × ${item.name[lang]}${item.size ? ` (${item.size})` : ""} — ${money(item.subtotal, lang)}`);
  const track = /^[0-9a-f]{64}$/.test(order.tracking_token) && siteUrl ? new URL(`/${lang}/track/${order.tracking_token}`, siteUrl).href : null;
  const payment = text.labels.payment[order.payment] ?? "";
  const body = [
    head.heading, "", head.lead, "",
    `${text.labels.pickup}: ${pickupDate(new Date(order.pickup_at).toISOString(), lang)}`, "",
    ...lines, "",
    order.tax_cents ? `${text.labels.tax}: ${money(order.tax_cents, lang)}` : "",
    `${text.labels.total}: ${money(order.total, lang)}`, payment,
    ...(kind === "store_notification" ? ["", `Client: ${order.customer}`] : []),
    ...(track && kind !== "store_notification" ? ["", `${text.labels.track}: ${track}`] : []), "", text.labels.sign,
  ].filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n");
  const html = `<!doctype html><html lang="${lang}"><body style="margin:0;background:${palette.cream};font-family:Arial,Helvetica,sans-serif;color:${palette.brown}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden">
<tr><td style="background:${palette.coral};color:#fff;padding:24px 28px;font-size:22px;font-weight:bold">Salut Bon Bon Thé</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 8px;font-size:22px">${escapeHtml(head.heading)}</h1>
<p style="margin:0 0 16px">${escapeHtml(head.lead)}</p>
<p style="margin:0 0 16px"><strong>${escapeHtml(text.labels.pickup)}:</strong> ${escapeHtml(pickupDate(new Date(order.pickup_at).toISOString(), lang))}</p>
<ul style="padding-left:18px;margin:0 0 16px">${lines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
${order.tax_cents ? `<p style="margin:0">${escapeHtml(text.labels.tax)}: ${escapeHtml(money(order.tax_cents, lang))}</p>` : ""}
<p style="margin:4px 0 16px;font-size:18px"><strong>${escapeHtml(text.labels.total)}: ${escapeHtml(money(order.total, lang))}</strong>${payment ? ` · ${escapeHtml(payment)}` : ""}</p>
${kind === "store_notification" ? `<p>Client : ${escapeHtml(order.customer)}</p>` : ""}
${track && kind !== "store_notification" ? `<p><a href="${escapeHtml(track)}" style="display:inline-block;background:${palette.mango};color:${palette.brown};padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(text.labels.track)}</a></p>` : ""}
</td></tr>
<tr><td style="padding:16px 28px;background:${palette.cream};font-size:12px">${escapeHtml(text.labels.sign)}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject: head.subject, text: body, html };
}

/** Test mode only reaches the configured test recipient. Live mode needs a live flag and explicit approval. */
export function emailMode(): "test" | "live" | "disabled" {
  const { RESEND_API_KEY, RESEND_FROM } = process.env;
  if (!process.env.DATABASE_URL || !RESEND_API_KEY || !RESEND_FROM) return "disabled";
  if (process.env.RESEND_MODE === "live") return process.env.SALUT_LIVE_EMAIL_APPROVED === "1" ? "live" : "disabled";
  return process.env.SALUT_RESEND_TEST_ENABLED === "1" && process.env.RESEND_TEST_RECIPIENT ? "test" : "disabled";
}

export async function enqueueOrderEmails(number: string, kinds: EmailKind[], db?: Db) {
  const connection = db ?? await database();
  await connection.query(`
    INSERT INTO email_outbox (order_number, kind, recipient, locale)
    SELECT o.number, k.kind,
      CASE WHEN k.kind = 'store_notification' THEN $3 ELSE o.customer_email END, o.locale
    FROM orders o CROSS JOIN unnest($2::text[]) AS k(kind)
    WHERE o.number = $1 AND (CASE WHEN k.kind = 'store_notification' THEN $3 ELSE o.customer_email END) IS NOT NULL
    ON CONFLICT (order_number, kind) DO NOTHING
  `, [number, kinds, process.env.STORE_NOTIFICATION_EMAIL || null]);
}

type Claimed = { id: string; order_number: string; kind: EmailKind; recipient: string; locale: Lang };

export async function deliverPendingEmails(options: { limit?: number; db?: Db; fetchImpl?: typeof fetch } = {}) {
  const connection = options.db ?? await database();
  const send = options.fetchImpl ?? fetch;
  const mode = emailMode();
  const result = { sent: 0, skipped: 0, failed: 0 };
  if (mode === "disabled") return result;
  const { rows } = await connection.query<Claimed>(`
    UPDATE email_outbox SET attempts = attempts + 1
    WHERE id IN (SELECT id FROM email_outbox WHERE status IN ('PENDING', 'FAILED') AND attempts < 5
                 ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
    RETURNING id, order_number::text AS order_number, kind, recipient, locale
  `, [options.limit ?? 10]);
  for (const mail of rows) {
    if (mode === "test" && mail.recipient !== process.env.RESEND_TEST_RECIPIENT) {
      await connection.query("UPDATE email_outbox SET status = 'SKIPPED', last_error = 'test mode: recipient not allowed' WHERE id = $1", [mail.id]);
      result.skipped++;
      continue;
    }
    try {
      const { rows: [order] } = await connection.query<OrderRow>(
        "SELECT number::text AS number, customer, locale, pickup_at, total, tax_cents, payment, tracking_token, items FROM orders WHERE number = $1", [mail.order_number]);
      const message = orderEmail(mail.kind, order, mail.locale);
      const response = await send("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json",
          "Idempotency-Key": `salut-order-${mail.order_number}-${mail.kind}`,
        },
        body: JSON.stringify({ from: process.env.RESEND_FROM, to: [mail.recipient], ...message }),
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
      await connection.query("UPDATE email_outbox SET status = 'SENT', sent_at = now(), last_error = NULL WHERE id = $1", [mail.id]);
      result.sent++;
    } catch (error) {
      await connection.query("UPDATE email_outbox SET status = 'FAILED', last_error = $2 WHERE id = $1",
        [mail.id, (error instanceof Error ? error.message : "send failed").slice(0, 200)]);
      result.failed++;
    }
  }
  return result;
}

/** Best-effort: queue then try once; the retry route or cron picks up anything left behind. */
export async function notifyOrder(number: string, kinds: EmailKind[]) {
  try {
    await enqueueOrderEmails(number, kinds);
    await deliverPendingEmails();
  } catch (error) {
    console.error("order notification failed", { order: number, message: error instanceof Error ? error.message : "unknown" });
  }
}
