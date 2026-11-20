"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { language } from "../../../../src/domain";
import { revokeIdentifier, rotateIdentifier } from "../../../../src/identification";
import { staffActor, staffRole } from "../../../../src/staff";

/** ADMIN: replace (new QR, old one stops working) or revoke (no QR, Wallet pass voided) a member's card QR, e.g. after a lost phone. */
export async function cardQrAction(lang: string, form: FormData) {
  if (!language(lang) || !process.env.DATABASE_URL || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  const parsed = z.object({ account: z.uuid(), op: z.enum(["rotate", "revoke"]), user: z.string().regex(/^[\w-]{1,64}$/).optional() })
    .safeParse({ account: form.get("account"), op: form.get("op"), user: form.get("user") || undefined });
  if (!parsed.success) return;
  const actor = await staffActor();
  if (parsed.data.op === "rotate") await rotateIdentifier(parsed.data.account, actor);
  else await revokeIdentifier(parsed.data.account, actor);
  revalidatePath(`/${lang}/admin/customers`, "layout");
  if (parsed.data.user) redirect(`/${lang}/admin/customers/${parsed.data.user}?saved=${parsed.data.op}`);
}
