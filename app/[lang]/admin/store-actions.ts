"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { setOrderingEnabled } from "../../../src/admin-reports";
import { language } from "../../../src/domain";
import { adminAction, text } from "./guard";

/** The one switch for taking online orders. Shown on the dashboard and on the hours page; both submit here. */
export async function setOrdering(lang: string, form: FormData) {
  const actor = await adminAction();
  if (!language(lang)) return;
  const enabled = text(form, "enabled") === "1";
  await setOrderingEnabled(enabled, actor);
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}${text(form, "back") === "hours" ? "/admin/hours" : "/admin"}?saved=${enabled ? "resumed" : "paused"}`);
}
