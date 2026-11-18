import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import pg from "pg";

const { STAFF_SMOKE_DATABASE_URL, STAFF_SMOKE_BASE_URL } = process.env;
if (!STAFF_SMOKE_DATABASE_URL || !STAFF_SMOKE_BASE_URL) {
  throw new Error("Set STAFF_SMOKE_DATABASE_URL and STAFF_SMOKE_BASE_URL for a disposable migrated test database and its Better Auth app.");
}

const suffix = randomBytes(6).toString("hex");
const email = role => `smoke-${role.toLowerCase()}-${suffix}@example.com`;
const password = randomBytes(24).toString("hex");
const name = `Role Smoke ${suffix}`;
const pool = new pg.Pool({ connectionString: STAFF_SMOKE_DATABASE_URL });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium", args: ["--no-sandbox"] });
const emails = ["STAFF", "ADMIN", "CUSTOMER"].map(email);
let orderNumber;

async function signIn(page, role) {
  await page.goto(new URL("/en/staff", STAFF_SMOKE_BASE_URL).href);
  await page.getByLabel("Email").fill(email(role));
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

try {
  for (const role of ["STAFF", "ADMIN", "CUSTOMER"]) {
    execFileSync(process.execPath, ["scripts/create-staff.mjs", role === "CUSTOMER" ? "STAFF" : role, email(role), name], {
      input: password, env: { ...process.env, DATABASE_URL: STAFF_SMOKE_DATABASE_URL },
    });
  }
  await pool.query('UPDATE "user" SET role = $1 WHERE email = $2', ["CUSTOMER", email("CUSTOMER")]);
  const order = await pool.query(`
    INSERT INTO orders (request_id, request_fingerprint, tracking_token, locale, customer, notes, pickup_at, items, total, payment)
    VALUES ($1, 'smoke', $2, 'en', $3, '', now(), '[]', 675, 'UNPAID') RETURNING number
  `, [randomUUID(), randomBytes(32).toString("hex"), name]);
  orderNumber = order.rows[0].number;

  const guest = await browser.newPage();
  await guest.goto(new URL("/en/staff", STAFF_SMOKE_BASE_URL).href);
  await guest.getByLabel("Email").waitFor();
  assert.equal(await guest.getByText(name).count(), 0);
  assert.equal((await guest.request.get(new URL("/en/admin", STAFF_SMOKE_BASE_URL).href)).status(), 404);
  await signIn(guest, "CUSTOMER");
  await guest.getByRole("alert").filter({ hasText: "Sign-in failed." }).waitFor();
  assert.equal(await guest.getByText(name).count(), 0);

  const staff = await browser.newPage();
  await signIn(staff, "STAFF");
  const staffCard = staff.locator("article").filter({ hasText: name });
  await staffCard.getByRole("button", { name: "→ Confirmed" }).click();
  await staffCard.getByRole("button", { name: "→ Preparing" }).waitFor();
  assert.equal((await staff.request.get(new URL("/en/admin", STAFF_SMOKE_BASE_URL).href)).status(), 404);

  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, "ADMIN");
  await admin.getByText("ADMINISTRATION", { exact: true }).waitFor();
  if (process.env.STAFF_SMOKE_CATALOG === "1") {
    const page = await admin.context().newPage();
    await page.goto(new URL("/en/admin", STAFF_SMOKE_BASE_URL).href);
    await page.getByRole("heading", { name: "Pricing and availability" }).waitFor();
    await page.close();
  }
  const adminCard = admin.locator("article").filter({ hasText: name });
  await adminCard.getByRole("button", { name: "→ Preparing" }).click();
  await adminCard.getByRole("button", { name: "→ Ready" }).waitFor();

  await pool.query('UPDATE "user" SET role = $1 WHERE email = $2', ["CUSTOMER", email("ADMIN")]);
  // The already rendered admin form must still be subject to current server authorization.
  await adminCard.getByRole("button", { name: "→ Ready" }).click();
  await admin.getByLabel("Email").waitFor();
  assert.equal((await pool.query("SELECT status FROM orders WHERE number = $1", [orderNumber])).rows[0].status, "PREPARING");
  await staff.getByRole("button", { name: "Sign out" }).click();
  await staff.getByLabel("Email").waitFor();
  assert.equal(await staff.getByText(name).count(), 0);
  console.log("Staff authorization smoke passed for guest, CUSTOMER, STAFF, ADMIN, demotion and sign-out.");
} finally {
  await browser.close();
  if (orderNumber) {
    await pool.query("DELETE FROM order_events WHERE order_number = $1", [orderNumber]);
    await pool.query("DELETE FROM orders WHERE number = $1", [orderNumber]);
  }
  await pool.query('DELETE FROM "user" WHERE email = ANY($1)', [emails]);
  await pool.end();
}
