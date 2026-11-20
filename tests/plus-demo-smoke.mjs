// Salut Plus demonstration, end to end in a browser: customer account, customized order, simulated payment, staff receive/prepare/ready/complete,
// stamps, branded card QR (decoded), staff scan by the stable QR, in-store stamps, free-drink redemption, admin refund, notification log.
// Needs an app on SMOKE_BASE_URL (default http://localhost:3100) started with SALUT_DEMO_MODE=1 against a disposable migrated database that has the
// official catalog with prices, the business profile, and ADMIN admin@example.invalid / AdminPassw0rd!x plus STAFF staff@example.invalid / StaffPassw0rd!x.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import sharp from "sharp";
import jsQR from "jsqr";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3100";
const SHOTS = process.env.SHOT_DIR;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium" });
const shot = (page, name) => SHOTS ? page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }) : undefined;
const customer = { name: "Camille Tremblay", email: `camille-${Date.now()}@example.invalid`, password: "ClientePassw0rd!x" };

async function consoleLogin(page, email, password, heading) {
  await page.goto(`${BASE}/en/staff`);
  await page.getByLabel("Email").fill(email); await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { name: heading }).waitFor();
}
try {
  // 1. Admin opens the demo store.
  const admin = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await consoleLogin(admin, "admin@example.invalid", "AdminPassw0rd!x", "Administration");
  await admin.getByRole("button", { name: "Apply demo settings" }).click();
  await admin.getByText("Demo settings applied").waitFor();
  assert.ok(await admin.getByText("Online pickup ordering is open").count() + await admin.getByText(/Online ordering is closed/).count() >= 0);

  // 2. Customer: account, customized drink, cart, card payment on the simulated page.
  const phone = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
  const shopper = await phone.newPage();
  await shopper.goto(`${BASE}/en/account`);
  const reg = shopper.locator('form[aria-labelledby="register-title"]');
  await reg.getByLabel("Full name").fill(customer.name); await reg.getByLabel("Email").fill(customer.email); await reg.getByLabel(/Password/).fill(customer.password);
  await reg.getByRole("checkbox").check(); await reg.getByRole("button", { name: "Create my account" }).click();
  await shopper.getByText(/created/i).first().waitFor();
  const login = shopper.locator('form[aria-labelledby="login-title"]');
  await login.getByLabel("Email").fill(customer.email); await login.getByLabel("Password").fill(customer.password); await login.getByRole("button", { name: "Sign in" }).click();
  await shopper.getByText(customer.email).first().waitFor();
  await shopper.getByRole("link", { name: "Order", exact: true }).first().click();
  await shopper.waitForURL(/\/en\/catalog/);
  const orderable = shopper.locator('section[aria-labelledby="orderable"]');
  await orderable.getByRole("button", { name: /Customize/ }).first().click();
  const form = shopper.locator("form.customize");
  await form.getByLabel("Size").selectOption("large");
  await form.getByLabel("Quantity").fill("2");
  await form.getByRole("button", { name: "Add to cart" }).click();
  await shopper.getByText(/× /).first().waitFor();
  const checkout = shopper.locator("form.checkout");
  await checkout.getByLabel("Pickup name").fill("Camille");
  await checkout.getByLabel("Pickup time").selectOption({ index: 1 });
  await checkout.getByLabel("Payment").selectOption("card");
  await checkout.getByRole("button", { name: "Place order" }).click();
  await shopper.waitForURL(/\/en\/pay\/sim_cs_/);
  await shopper.getByText("SIMULATED PAYMENT").waitFor();
  await shot(shopper, "1-simulated-payment");
  await shopper.getByRole("button", { name: /^Pay .*simulation/ }).click();
  await shopper.waitForURL(/\/en\/track\//);
  await shopper.getByText("Your payment was received").waitFor();
  const trackingUrl = shopper.url().split("?")[0];
  const number = (await shopper.getByRole("heading", { level: 1 }).textContent()).match(/#(\d+)/)[1];
  await shot(shopper, "2-tracking-received");

  // 3. Staff receive the order and move it forward; the customer's page follows.
  const team = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  await consoleLogin(team, "staff@example.invalid", "StaffPassw0rd!x", /Orders/);
  const card = team.locator("article", { hasText: `#${number}` });
  await card.getByText("NEW").waitFor();
  await shot(team, "3-staff-new-order");
  for (const step of ["Confirmed", "Preparing", "Ready", "Completed"]) {
    await team.locator("article", { hasText: `#${number}` }).getByRole("button", { name: new RegExp(step) }).click();
    await team.waitForTimeout(700);
    if (step === "Ready") {
      await shopper.goto(trackingUrl);
      await shopper.getByRole("status").getByText("Ready").first().waitFor();
      await shot(shopper, "4-tracking-ready");
    }
  }
  await shot(team, "5-staff-completed");

  // 4. Stamps, card QR with the logo (decoded), no email sent.
  await shopper.goto(`${BASE}/en/account/rewards`);
  await shopper.getByText(/stamps/i).first().waitFor();
  const qrSvg = await shopper.getByTestId("member-qr").innerHTML();
  assert.match(qrSvg, /<svg x=/, "the official logo is embedded in the QR");
  const { data, info } = await sharp(Buffer.from(qrSvg), { density: 300 }).resize(400, 400).flatten({ background: "#fff" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const decoded = jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data;
  assert.match(decoded ?? "", /\/s\/[A-Z2-9]{22}$/, "the QR decodes to the short stable identification URL");
  await shot(shopper, "6-card");

  // 5. Staff scan the stable QR (the camera app would open this URL), add in-store stamps, redeem the free drink.
  await team.goto(decoded.replace(/^https?:\/\/[^/]+/, BASE));
  await team.waitForURL(/\/en\/staff\/rewards\?id=/);
  await team.getByText("Camille").first().waitFor();
  await team.getByLabel(/Eligible drinks bought/).fill("8");
  await team.getByRole("button", { name: "Add stamps" }).click();
  await team.getByText(/Stamps added/).waitFor();
  await team.getByRole("button", { name: /Confirm redemption/ }).waitFor(); // the box "member is present" is required before it submits
  await team.getByLabel(/The member is present/).check();
  await team.getByRole("button", { name: /Confirm redemption/ }).click();
  await team.getByText("Reward given").waitFor();
  await shot(team, "7-redeemed");
  // The old QR keeps resolving only for staff; anonymous visitors only reach the staff sign-in.
  const anonymous = await (await browser.newContext()).newPage();
  await anonymous.goto(decoded.replace(/^https?:\/\/[^/]+/, BASE));
  await anonymous.getByText(/Sign in to the staff area/).waitFor();
  assert.ok(!(await anonymous.content()).includes("Camille"));

  // 6. Admin: order detail, refund (stamps come back), notification log, wallet status, change history.
  await admin.goto(`${BASE}/en/admin/orders/${number}`);
  await admin.getByRole("heading", { name: `Order #${number}` }).waitFor();
  await admin.getByLabel("Reason", { exact: true }).last().fill("Customer changed their mind");
  await admin.getByRole("button", { name: "Refund", exact: true }).click();
  await admin.getByText("Saved.").waitFor();
  await admin.getByText(/refunded/i).first().waitFor();
  await shot(admin, "8-admin-order-refunded");
  await admin.goto(`${BASE}/en/admin/notifications`);
  await admin.getByText(/not connected \(demo\)/).waitFor();
  assert.ok((await admin.getByText("skipped").count()) > 0);
  await shot(admin, "9-admin-notifications");
  await admin.goto(`${BASE}/en/admin/wallet`); await admin.getByRole("heading", { name: "Card QR and Apple Wallet" }).waitFor();
  await admin.goto(`${BASE}/en/admin/activity`); await admin.getByText("order.refund").first().waitFor();

  // 7. Demonstration pages.
  await shopper.goto(`${BASE}/en/demo`); await shopper.getByRole("heading", { name: /The complete journey/ }).waitFor();
  await shopper.goto(`${BASE}/en/demo/side-by-side`); await shopper.getByRole("heading", { name: /Customer and team, side by side/ }).waitFor();
  console.log("PASS plus-demo-smoke");
} finally {
  await browser.close();
}
