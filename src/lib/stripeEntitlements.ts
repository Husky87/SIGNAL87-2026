type StripeList<T> = { data: T[]; has_more: boolean };
type StripeCustomer = { id: string; email?: string | null };
type StripeSubscription = {
  status: string;
  metadata?: { signal87_uid?: string; signal87_email?: string };
};

async function stripeGet<T>(path: string, params: URLSearchParams, secretKey: string): Promise<T> {
  const response = await fetch(`https://api.stripe.com/v1/${path}?${params}`, {
    headers: { Authorization: `Bearer ${secretKey}`, Accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`Stripe lookup failed [HTTP ${response.status}]`);
  return response.json() as Promise<T>;
}

/** Read live Stripe state rather than trusting a checkout return URL or browser storage. */
export async function hasActiveStripeSubscription(
  uid: string,
  email: string,
  emailVerified: boolean,
  secretKey: string
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!uid || !normalizedEmail || !secretKey) return false;

  let customerCursor: string | undefined;
  // Bound requests to prevent an unusual account with many duplicate customer
  // records from keeping a serverless invocation open indefinitely.
  for (let page = 0; page < 10; page++) {
    const query = new URLSearchParams({ email: normalizedEmail, limit: '100' });
    if (customerCursor) query.set('starting_after', customerCursor);
    const customers = await stripeGet<StripeList<StripeCustomer>>('customers', query, secretKey);
    for (const customer of customers.data) {
      if (customer.email?.trim().toLowerCase() !== normalizedEmail) continue;
      let subscriptionCursor: string | undefined;
      for (let subscriptionPage = 0; subscriptionPage < 10; subscriptionPage++) {
        const subscriptionQuery = new URLSearchParams({ customer: customer.id, status: 'all', limit: '100' });
        if (subscriptionCursor) subscriptionQuery.set('starting_after', subscriptionCursor);
        const subscriptions = await stripeGet<StripeList<StripeSubscription & { id: string }>>('subscriptions', subscriptionQuery, secretKey);
        if (subscriptions.data.some((subscription) =>
          (subscription.status === 'active' || subscription.status === 'trialing') &&
          (subscription.metadata?.signal87_uid === uid ||
            (emailVerified && !subscription.metadata?.signal87_uid))
        )) return true;
        if (!subscriptions.has_more || !subscriptions.data.length) break;
        subscriptionCursor = subscriptions.data.at(-1)?.id;
      }
    }
    if (!customers.has_more || !customers.data.length) return false;
    customerCursor = customers.data.at(-1)?.id;
  }
  // An incomplete search must never be misreported as an inactive subscriber.
  throw new Error('Stripe customer lookup exceeded pagination limit');
}
