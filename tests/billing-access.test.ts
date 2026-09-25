import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXISTING_USER_GRACE_START, getTrialStatus } from '../src/lib/trial';
import { hasActiveStripeSubscription } from '../src/lib/stripeEntitlements';

const day = 24 * 60 * 60 * 1000;
const oldUser = { metadata: { creationTime: '2025-01-01T00:00:00.000Z' } } as any;
const newUser = { metadata: { creationTime: '2026-09-26T10:00:00.000Z' } } as any;

test('existing accounts receive five days from September 24', () => {
  assert.equal(getTrialStatus(oldUser, EXISTING_USER_GRACE_START + 4 * day).isExpired, false);
  assert.equal(getTrialStatus(oldUser, EXISTING_USER_GRACE_START + 5 * day).isExpired, true);
  assert.equal(getTrialStatus(oldUser, EXISTING_USER_GRACE_START).daysRemaining, 5);
});

test('new accounts receive five days from account creation', () => {
  const created = Date.parse(newUser.metadata.creationTime);
  assert.equal(getTrialStatus(newUser, created + 4 * day).isExpired, false);
  assert.equal(getTrialStatus(newUser, created + 5 * day).isExpired, true);
});

test('verified legacy subscribers retain access', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const payload = url.pathname.endsWith('/customers')
      ? { data: [{ id: 'cus_1', email: 'subscriber@example.com' }], has_more: false }
      : { data: [{ id: 'sub_1', status: 'active', metadata: {} }], has_more: false };
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(await hasActiveStripeSubscription('uid_1', 'Subscriber@Example.com', true, 'sk_test'), true);
    assert.equal(await hasActiveStripeSubscription('uid_1', 'subscriber@example.com', false, 'sk_test'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('canceled subscriptions do not grant access', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const payload = url.pathname.endsWith('/customers')
      ? { data: [{ id: 'cus_1', email: 'subscriber@example.com' }], has_more: false }
      : { data: [{ id: 'sub_1', status: 'canceled', metadata: {} }], has_more: false };
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(await hasActiveStripeSubscription('uid_1', 'subscriber@example.com', true, 'sk_test'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('new subscriptions must belong to the signed-in Firebase UID', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    const payload = url.pathname.endsWith('/customers')
      ? { data: [{ id: 'cus_1', email: 'subscriber@example.com' }], has_more: false }
      : { data: [{ id: 'sub_1', status: 'active', metadata: { signal87_uid: 'uid_1' } }], has_more: false };
    return new Response(JSON.stringify(payload), { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(await hasActiveStripeSubscription('uid_1', 'subscriber@example.com', false, 'sk_test'), true);
    assert.equal(await hasActiveStripeSubscription('uid_2', 'subscriber@example.com', true, 'sk_test'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
