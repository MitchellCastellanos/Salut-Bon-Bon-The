import type { Lang } from "../domain";

type Notice = "confirmed" | "ready";

export function orderNotice(lang: Lang, notice: Notice, number: string) {
  if (!/^\d+$/.test(number)) throw new Error("Invalid order number");
  const fr = lang === "fr";
  const subject = notice === "ready" ?
    fr ? `Commande n° ${number} prête pour la cueillette` : `Order #${number} ready for pickup` :
    fr ? `Commande n° ${number} confirmée` : `Order #${number} confirmed`;
  return { subject, text: `${subject}.\n\nSalut Bon Bon Thé` };
}

export async function sendResendTestNotice(input: {
  to: string; lang: Lang; notice: Notice; number: string; idempotencyKey: string;
}) {
  const { RESEND_API_KEY, RESEND_FROM, RESEND_TEST_RECIPIENT } = process.env;
  if (!process.env.DATABASE_URL || process.env.SALUT_RESEND_TEST_ENABLED !== "1" ||
      !RESEND_API_KEY || !RESEND_FROM || !RESEND_TEST_RECIPIENT || input.to !== RESEND_TEST_RECIPIENT) {
    throw new Error("Resend test integration is disabled for this recipient");
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({ from: RESEND_FROM, to: [input.to], ...orderNotice(input.lang, input.notice, input.number) }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`);
}
