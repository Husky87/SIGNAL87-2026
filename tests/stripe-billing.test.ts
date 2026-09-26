import assert from 'node:assert/strict';
import { hasActiveSubscription } from '../src/lib/stripeBilling';

const originalFetch = globalThis.fetch;
try {
  let subscriptions: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/customers')) {
      assert.equal(url.searchParams.get('email'), 'payer@example.com');
      return Response.json({ data: [{ id: 'cus_1', email: 'payer@example.com' }], has_more: false });
    }
    assert.equal(url.searchParams.get('customer'), 'cus_1');
    return Response.json({ data: subscriptions, has_more: false });
  };

  subscriptions = [{ status: 'active', metadata: { signal87_uid: 'user-1' } }];
  assert.equal(await hasActiveSubscription('secret', 'user-1', 'payer@example.com', false, ['price_1']), true);
  assert.equal(await hasActiveSubscription('secret', 'user-2', 'payer@example.com', true, ['price_1']), false);

  subscriptions = [{ status: 'past_due', metadata: { signal87_uid: 'user-1' } }];
  assert.equal(await hasActiveSubscription('secret', 'user-1', 'payer@example.com', true, ['price_1']), false);

  subscriptions = [{ status: 'active', metadata: {}, items: { data: [{ price: { id: 'price_1' } }] } }];
  assert.equal(await hasActiveSubscription('secret', 'user-1', 'payer@example.com', false, ['price_1']), false);
  assert.equal(await hasActiveSubscription('secret', 'user-1', 'payer@example.com', true, ['price_1']), true);
  assert.equal(await hasActiveSubscription('secret', 'user-1', 'payer@example.com', true, ['other_price']), false);
  console.log('Stripe billing ownership and status checks passed');
} finally {
  globalThis.fetch = originalFetch;
}
