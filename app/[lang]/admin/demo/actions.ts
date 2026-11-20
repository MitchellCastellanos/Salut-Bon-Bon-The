"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { demoMode } from "../../../../src/demo-mode";
import { applyDemoSettings } from "../../../../src/demo-setup";
import { language } from "../../../../src/domain";
import { staffActor, staffRole } from "../../../../src/staff";

/** ADMIN, demo mode only: makes the test store operational (hours, capacity, offered products, rewards active). Audited; never touches prices or providers. */
export async function prepareDemo(lang: string) {
  if (!language(lang) || !demoMode() || await staffRole() !== "ADMIN") throw new Error("Forbidden");
  await applyDemoSettings(await staffActor());
  revalidatePath(`/${lang}`, "layout");
  redirect(`/${lang}/admin?demo=ready`);
}
