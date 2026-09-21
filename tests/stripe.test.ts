/**
 * Stripe billing regression suite.
 *
 * No live Stripe credentials or network access are available in CI's sandbox
 * for this repo, so this drives the real handlers directly: checkout-session
 * creation with a mocked fetch (inspecting the exact outbound request), and
 * the webhook with synthetically-signed payloads using the same HMAC scheme
 * Stripe uses, computed independently here rather than reusing the handler's
 * own signer — so a bug in that signer would actually be caught.
 */
import { createHmac } from 'node:crypto';
import checkoutHandler from '../api/create-checkout-session';
import webhookHandler from '../api/stripe-webhook';

process.env.SIGNAL87_TEST_AUTH = '1';

const results: string[] = [];
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++;
  results.push(`${ok ? 'PASS  ' : 'FAIL  '}${name}${ok ? '' : '\n        -> ' + detail}`);
}

function makeRes() {
  const res: any = {
    statusCode: 200,
    setHeader() { return this; },
    status(c: number) { this.statusCode = c; return this; },
    json(p: any) { this.payload = p; return this; }
  };
  return res;
}

async function testCreateCheckoutSession() {
  // 1. No auth header at all -> the SIGNAL87_TEST_AUTH bypass ignores this,
  //    so temporarily disable it to prove the auth gate itself works.
  {
    delete process.env.SIGNAL87_TEST_AUTH;
    const res = makeRes();
    await checkoutHandler({ method: 'POST', headers: {}, body: { email: 'a@b.com' } } as any, res);
    check('rejects unauthenticated requests', res.statusCode === 401, `got ${res.statusCode}: ${JSON.stringify(res.payload)}`);
    process.env.SIGNAL87_TEST_AUTH = '1';
  }

  // 2. Authenticated, but Stripe isn't configured in this environment.
  {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_PRICE_ID;
    const res = makeRes();
    await checkoutHandler({ method: 'POST', headers: {}, body: { email: 'a@b.com' } } as any, res);
    check('reports 503 (not a crash) when Stripe keys are absent', res.statusCode === 503, `got ${res.statusCode}: ${JSON.stringify(res.payload)}`);
    check('the 503 does not leak whether a key exists, just that billing is unavailable', !JSON.stringify(res.payload).match(/sk_|STRIPE_SECRET_KEY/), JSON.stringify(res.payload));
  }

  process.env.STRIPE_SECRET_KEY = 'sk_test_diagnostic_dummy';
  process.env.STRIPE_PRICE_ID = 'price_diagnostic_dummy';

  // 3. Missing / invalid email.
  {
    const res = makeRes();
    await checkoutHandler({ method: 'POST', headers: {}, body: {} } as any, res);
    check('rejects a missing email', res.statusCode === 400, `got ${res.statusCode}`);
  }
  {
    const res = makeRes();
    await checkoutHandler({ method: 'POST', headers: {}, body: { email: 'not-an-email' } } as any, res);
    check('rejects a malformed email', res.statusCode === 400, `got ${res.statusCode}`);
  }

  // 4. Wrong method.
  {
    const res = makeRes();
    await checkoutHandler({ method: 'GET', headers: {}, body: {} } as any, res);
    check('rejects non-POST methods', res.statusCode === 405, `got ${res.statusCode}`);
  }

  // 5. Happy path — mock Stripe's response and inspect the *outbound* request.
  {
    const realFetch = globalThis.fetch;
    let sentUrl = ''; let sentAuth = ''; let sentBody = '';
    globalThis.fetch = (async (url: any, init: any) => {
      sentUrl = String(url);
      sentAuth = init.headers.Authorization;
      sentBody = init.body;
      return { ok: true, json: async () => ({ url: 'https://checkout.stripe.com/c/pay/cs_test_diagnostic' }) };
    }) as any;
    const res = makeRes();
    try {
      await checkoutHandler({ method: 'POST', headers: {}, body: { email: 'buyer@example.com' } } as any, res);
    } finally {
      globalThis.fetch = realFetch;
    }
    check('calls the real Stripe Checkout Sessions endpoint', sentUrl === 'https://api.stripe.com/v1/checkout/sessions', sentUrl);
    check('authenticates with the configured secret key as a Bearer token', sentAuth === 'Bearer sk_test_diagnostic_dummy', sentAuth);
    check('the configured price ID is used, not a client-supplied one', decodeURIComponent(sentBody).includes('line_items[0][price]=price_diagnostic_dummy'), sentBody);
    check("the caller's email is passed through as customer_email", decodeURIComponent(sentBody).includes('customer_email=buyer@example.com'), sentBody);
    check('success/cancel URLs point at the real production domain', decodeURIComponent(sentBody).includes('signal87.ai'), sentBody);
    check('returns the Stripe-hosted checkout URL to the client', res.statusCode === 200 && res.payload?.url === 'https://checkout.stripe.com/c/pay/cs_test_diagnostic', JSON.stringify(res.payload));
  }

  // 6. Stripe itself rejects the request (e.g. bad price ID in a real account).
  {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok: false, json: async () => ({ error: { message: 'No such price: price_diagnostic_dummy' } }) })) as any;
    const res = makeRes();
    try {
      await checkoutHandler({ method: 'POST', headers: {}, body: { email: 'buyer@example.com' } } as any, res);
    } finally {
      globalThis.fetch = realFetch;
    }
    check('a Stripe-side rejection surfaces as 502, not 200', res.statusCode === 502, `got ${res.statusCode}`);
    check("Stripe's internal error detail is not echoed to the browser", !JSON.stringify(res.payload).includes('No such price'), JSON.stringify(res.payload));
  }

  delete process.env.STRIPE_SECRET_KEY;
  delete process.env.STRIPE_PRICE_ID;
}

function signStripePayload(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const signed = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${signed}`;
}

function fakeReqFromBody(body: string, headers: Record<string, string>) {
  // api/stripe-webhook.ts reads the raw body via `for await (const chunk of req)`
  // with bodyParser disabled — an async-iterable request stream is what it
  // actually gets from Vercel/Node, so reproduce that shape here rather than
  // handing it a pre-parsed body like every other handler in this codebase.
  return {
    method: 'POST',
    headers,
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(body, 'utf8');
    }
  };
}

async function testWebhook() {
  const secret = 'whsec_diagnostic_dummy_secret';
  const event = JSON.stringify({
    id: 'evt_diagnostic_1',
    type: 'checkout.session.completed',
    data: { object: { id: 'cs_test_1', customer: 'cus_1', subscription: 'sub_1', customer_email: 'buyer@example.com', payment_status: 'paid' } }
  });

  // 1. Not configured.
  {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(event, { 'stripe-signature': signStripePayload(event, secret) }) as any, res);
    check('reports 503 when no webhook secret is configured, rather than accepting unverifiable events', res.statusCode === 503, `got ${res.statusCode}`);
  }

  process.env.STRIPE_WEBHOOK_SECRET = secret;

  // 2. Missing signature header entirely.
  {
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(event, {}) as any, res);
    check('rejects a request with no Stripe-Signature header', res.statusCode === 400, `got ${res.statusCode}`);
  }

  // 3. Signature computed with the wrong secret (forged / stale key).
  {
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(event, { 'stripe-signature': signStripePayload(event, 'wrong_secret') }) as any, res);
    check('rejects a signature computed with the wrong secret', res.statusCode === 400, `got ${res.statusCode}`);
  }

  // 4. Signature valid for a payload that was then tampered with.
  {
    const validSig = signStripePayload(event, secret);
    const tampered = event.replace('cus_1', 'cus_ATTACKER_SUBSTITUTED');
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(tampered, { 'stripe-signature': validSig }) as any, res);
    check('rejects a payload that was tampered with after signing', res.statusCode === 400, `got ${res.statusCode}`);
  }

  // 5. Signature is valid but old (outside the 300s tolerance) — replay defense.
  {
    const oldSig = signStripePayload(event, secret, Math.floor(Date.now() / 1000) - 1000);
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(event, { 'stripe-signature': oldSig }) as any, res);
    check('rejects a validly-signed but stale (replayed) event', res.statusCode === 400, `got ${res.statusCode}`);
  }

  // 6. A genuinely valid, fresh, correctly-signed event.
  {
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(event, { 'stripe-signature': signStripePayload(event, secret) }) as any, res);
    check('accepts a validly-signed, fresh checkout.session.completed event', res.statusCode === 200, `got ${res.statusCode}: ${JSON.stringify(res.payload)}`);
  }

  // 7. Every event type the handler explicitly recognizes should not crash it.
  for (const type of ['customer.subscription.updated', 'customer.subscription.deleted', 'invoice.paid', 'invoice.payment_failed', 'some.unrecognized.future.event']) {
    const body = JSON.stringify({ id: `evt_${type}`, type, data: { object: { id: 'x', customer: 'cus_1' } } });
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(body, { 'stripe-signature': signStripePayload(body, secret) }) as any, res);
    check(`handles "${type}" without error`, res.statusCode === 200, `got ${res.statusCode}: ${JSON.stringify(res.payload)}`);
  }

  // 8. Oversized payload is rejected before JSON parsing / signature work.
  {
    const huge = JSON.stringify({ id: 'evt_huge', type: 'x', data: { object: { junk: 'a'.repeat(2 * 1024 * 1024) } } });
    const res = makeRes();
    await webhookHandler(fakeReqFromBody(huge, { 'stripe-signature': signStripePayload(huge, secret) }) as any, res);
    check('rejects a webhook payload over the 1MB cap', res.statusCode === 413, `got ${res.statusCode}`);
  }

  // 9. Wrong method.
  {
    const res = makeRes();
    await webhookHandler({ method: 'GET', headers: {} } as any, res);
    check('rejects non-POST methods', res.statusCode === 405, `got ${res.statusCode}`);
  }

  delete process.env.STRIPE_WEBHOOK_SECRET;
}

async function run() {
  await testCreateCheckoutSession();
  await testWebhook();
  console.log(results.join('\n'));
  console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((e) => {
  console.error('harness error:', e);
  process.exit(1);
});
