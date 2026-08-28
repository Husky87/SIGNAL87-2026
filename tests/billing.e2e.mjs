/**
 * The subscription flow, as far as it can be driven without charging a card.
 *
 * /api/billing/plans is stubbed so the pricing UI renders against realistic
 * Stripe shapes, and the checkout call is intercepted so the "Subscribe"
 * button can be clicked and asserted on without leaving for Stripe.
 */
import { createServer } from 'vite';
import { chromium, devices } from 'playwright';

const PORT = 5320;
const CHROME = process.env.PLAYWRIGHT_CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
let failed = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failed++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
};

const PLANS = {
  configured: true,
  plans: [
    { priceId: 'price_solo', name: 'Solo', description: 'For one practitioner.',
      features: ['Unlimited documents', 'Citation-backed answers'],
      unitAmount: 4900, currency: 'usd', interval: 'month', intervalCount: 1 },
    { priceId: 'price_firm', name: 'Firm', description: 'For a whole practice.',
      features: ['Everything in Solo', 'Shared workspace', 'Priority support'],
      unitAmount: 19900, currency: 'usd', interval: 'month', intervalCount: 1 }
  ]
};

const vite = await createServer({ server: { port: PORT }, logLevel: 'error' });
await vite.listen();

let browser;
try {
  browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  async function open(path, { mobile = false, stubPlans = true } = {}) {
    const context = await browser.newContext(
      mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } }
    );
    const page = await context.newPage();
    if (stubPlans) {
      await page.route('**/api/billing/plans', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PLANS) })
      );
    } else {
      await page.route('**/api/billing/plans', (route) => route.fulfill({ status: 500, body: '{}' }));
    }
    let checkoutBody = null;
    await page.route('**/api/billing/checkout', async (route) => {
      checkoutBody = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: 'https://checkout.stripe.com/c/test' }) });
    });
    await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'load' });
    await page.waitForTimeout(1100);
    return { page, context, checkout: () => checkoutBody };
  }

  // ── the paywall ────────────────────────────────────────────────────────
  {
    const { page, context } = await open('/tests/billing.harness.html?view=paywall');
    check('paywall states the trial has ended', (await page.locator('text=Your free trial has ended').count()) === 1);
    check('paywall shows both plans from Stripe',
      (await page.locator('text=Solo').count()) >= 1 && (await page.locator('text=Firm').count()) >= 1);
    check('prices are formatted from Stripe amounts, not hardcoded',
      (await page.locator('text=$49 / month').count()) === 1 && (await page.locator('text=$199 / month').count()) === 1);
    check('the old mailto CTA is gone',
      (await page.locator('a[href^="mailto:"]').count()) === 0);
    await page.screenshot({ path: 'tests/.billing-paywall.png' });
    await context.close();
  }

  // ── checkout refuses to start without an account ───────────────────────
  // In the app the paywall is only reachable when signed in, so this is the
  // harness's state rather than a user's. It is still the behaviour worth
  // pinning: the uid is taken from a verified ID token, never from the body,
  // so a signed-out click must fail loudly here instead of reaching Stripe
  // and creating a subscription attached to nobody.
  {
    const { page, context, checkout } = await open('/tests/billing.harness.html?view=paywall');
    await page.locator('button:has-text("Subscribe")').last().click();
    await page.waitForTimeout(700);
    check('signed out, Subscribe never calls checkout', checkout() === null, JSON.stringify(checkout()));
    check('and the reason is shown rather than failing silently',
      (await page.locator('text=Sign in to continue.').count()) === 1);
    await context.close();
  }

  // ── unconfigured deployment degrades to a stated fallback ──────────────
  {
    const { page, context } = await open('/tests/billing.harness.html?view=paywall', { stubPlans: false });
    check('with no Stripe key it says so rather than showing an empty grid',
      (await page.locator('text=Online checkout').count()) >= 1);
    check('and still offers a way to pay', (await page.locator('a[href^="mailto:"]').count()) === 1);
    await context.close();
  }

  // ── trial banner ───────────────────────────────────────────────────────
  {
    const { page, context } = await open('/tests/billing.harness.html?view=banner');
    check('banner counts the days down', (await page.locator('text=4 days left in your trial').count()) === 1);
    check('banner singularises the last day', (await page.locator('text=1 day left in your trial').count()) === 1);
    check('banner offers a way to subscribe', (await page.locator('button:has-text("Subscribe")').count()) >= 1);
    await page.screenshot({ path: 'tests/.billing-banner.png' });
    await context.close();
  }

  // ── the managed state, for someone already paying ──────────────────────
  {
    const { page, context } = await open('/tests/billing.harness.html?view=managed');
    check('a subscriber is offered billing management, not plans',
      (await page.locator('text=Your subscription is active').count()) === 1 &&
      (await page.locator('text=$49 / month').count()) === 0);
    await context.close();
  }

  // ── landing page pricing, for a signed-out visitor ─────────────────────
  {
    const { page, context } = await open('/');
    check('the landing page has a pricing section', (await page.locator('#pricing').count()) === 1);
    await page.locator('#pricing').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    check('it shows the plans', (await page.locator('#pricing >> text=$49 / month').count()) === 1);
    check('its CTA starts a trial rather than checkout',
      (await page.locator('#pricing >> button:has-text("Start free trial")').count()) >= 1);
    await page.screenshot({ path: 'tests/.billing-landing.png' });
    await context.close();
  }

  // ── on a phone ─────────────────────────────────────────────────────────
  {
    const { page, context } = await open('/tests/billing.harness.html?view=paywall', { mobile: true });
    const geo = await page.evaluate(() => {
      const vw = innerWidth;
      const over = [...document.querySelectorAll('*')].filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && b.left < vw && b.right > vw + 1;
      }).length;
      const small = [...document.querySelectorAll('button,a')].filter((e) => {
        const b = e.getBoundingClientRect();
        return b.width > 0 && (b.width < 44 || b.height < 44);
      }).length;
      return { scrollW: document.documentElement.scrollWidth, vw, over, small };
    });
    check('paywall does not overflow a phone', geo.over === 0 && geo.scrollW <= geo.vw, JSON.stringify(geo));
    check('every paywall control is thumb-sized', geo.small === 0, JSON.stringify(geo));
    await page.screenshot({ path: 'tests/.billing-paywall-mobile.png' });
    await context.close();
  }
} finally {
  await browser?.close();
  await vite.close();
}

console.log(results.join('\n'));
console.log(failed === 0 ? `\nbilling: all ${results.length} checks passed` : `\nbilling: ${failed} FAILED`);
process.exit(failed === 0 ? 0 : 1);
