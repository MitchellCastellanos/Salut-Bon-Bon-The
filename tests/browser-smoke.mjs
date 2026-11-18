import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const base = process.env.SMOKE_BASE_URL || 'http://localhost:3100';
    if (process.argv[2]) {
      const page = await browser.newPage();
      await page.goto(process.argv[2]);
      await page.getByRole('status').filter({ hasText: 'Completed' }).waitFor();
      console.log('Completed order persisted after restart');
      return;
    }
    const guest = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const errors = [];
    guest.on('pageerror', error => errors.push(error.message));
    await guest.goto(base + '/fr');
    assert.equal(await guest.locator('html').getAttribute('lang'), 'fr-CA');
    await guest.getByRole('button', { name: 'Boisson suivante' }).click();
    await guest.getByRole('heading', { name: /série fraise/i }).waitFor();
    await guest.getByRole('heading', { name: 'Récompenses Salut' }).waitFor();
    await guest.getByRole('link', { name: 'English' }).click();
    await guest.getByRole('heading', { name: /mango series/i }).waitFor();
    assert.equal(await guest.locator('html').getAttribute('lang'), 'en-CA');
    assert.equal(await guest.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    await guest.getByRole('heading', { name: 'Salut Rewards' }).waitFor();
    await guest.getByRole('link', { name: 'Matcha', exact: true }).first().click();
    await guest.locator('#matcha').waitFor();
    assert.equal(await guest.locator('#mango').count(), 0);
    await guest.getByRole('button', { name: 'All', exact: true }).click();
    await guest.locator('#mango').getByRole('button', { name: /customize/i }).click();
    await guest.getByLabel('Size').selectOption('large');
    await guest.getByLabel('Topping').selectOption('popping');
    await guest.getByRole('button', { name: 'Add to cart' }).click();
    await guest.getByRole('link', { name: 'Cart', exact: true }).locator('.cart-count').getByText('1').waitFor();
    await guest.reload();
    await guest.locator('.cart').getByText('1 × Mango sunshine').waitFor();
    await guest.getByLabel('Pickup name').fill('QA Guest');
    await guest.getByLabel('Pickup time').locator('option').nth(1).waitFor({ state: 'attached' });
    await guest.getByLabel('Pickup time').selectOption({ index: 1 });
    await guest.getByRole('button', { name: 'Place order' }).click();
    await guest.waitForURL(/\/en\/track\/[a-f0-9]+$/);
    await guest.getByRole('status').filter({ hasText: 'Received' }).waitFor();
    assert.equal(await guest.getByText('QA Guest').count(), 0);
    const staff = await browser.newPage();
    staff.on('pageerror', error => errors.push(error.message));
    await staff.goto(base + '/en/staff');
    assert.equal(await staff.getByText('QA Guest').count(), 0);
    await staff.getByLabel('Password').fill('wrong');
    await staff.getByRole('button', { name: 'Sign in' }).click();
    await staff.getByRole('alert').filter({ hasText: 'Sign-in failed.' }).waitFor();
    await staff.getByLabel('Password').fill('salut-demo');
    await staff.getByRole('button', { name: 'Sign in' }).click();
    const order = staff.locator('article').filter({ hasText: 'QA Guest' }).first();
    await order.getByRole('button', { name: '→ Confirmed' }).click();
    await order.getByRole('button', { name: '→ Preparing' }).click();
    await guest.getByRole('status').filter({ hasText: 'Preparing' }).waitFor();
    await order.getByRole('button', { name: '→ Ready' }).click();
    await order.getByRole('button', { name: 'Record payment' }).click();
    await order.getByRole('button', { name: '→ Completed' }).click();
    await guest.getByRole('status').filter({ hasText: 'Completed' }).waitFor();
    assert.deepEqual(errors, []);
    if (process.env.SMOKE_RECEIPT_FILE) writeFileSync(process.env.SMOKE_RECEIPT_FILE, guest.url(), { mode: 0o600 });
    console.log('Browser smoke passed: mobile locale and carousel, persistent cart, guest checkout, private tracking, denied/valid staff login, payment and fulfillment.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
