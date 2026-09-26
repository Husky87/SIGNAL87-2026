type StripeList<T> = { data?: T[]; has_more?: boolean; error?: { message?: string } };
type StripeCustomer = { id: string; email?: string | null };
type StripeSubscription = { status: string; metadata?: Record<string, string>; items?: { data?: Array<{ price?: { id?: string } }> } };

async function stripeList<T>(url: URL, secret: string): Promise<T[]> {
  const items: T[] = [];
  for (let page = 0; page < 10; page++) {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${secret}` } });
    const body = await response.json() as StripeList<T>;
    if (!response.ok) throw new Error(body.error?.message || `Stripe returned HTTP ${response.status}`);
    const batch = body.data || [];
    items.push(...batch);
    if (!body.has_more) return items;
    const last = batch[batch.length - 1] as { id?: string } | undefined;
    if (!last?.id) throw new Error('Stripe pagination returned no cursor');
    url.searchParams.set('starting_after', last.id);
  }
  throw new Error('Too many billing records to verify safely');
}

/** Stripe is the durable subscription store; never trust a checkout success URL. */
export async function hasActiveSubscription(secret: string, uid: string, email: string, emailVerified: boolean, allowedPrices: string[]): Promise<boolean> {
  const customersUrl = new URL('https://api.stripe.com/v1/customers');
  customersUrl.searchParams.set('email', email);
  customersUrl.searchParams.set('limit', '100');
  const customers = await stripeList<StripeCustomer>(customersUrl, secret);
  for (const customer of customers) {
    if (customer.email?.toLowerCase() !== email.toLowerCase()) continue;
    const subscriptionsUrl = new URL('https://api.stripe.com/v1/subscriptions');
    subscriptionsUrl.searchParams.set('customer', customer.id);
    subscriptionsUrl.searchParams.set('status', 'all');
    subscriptionsUrl.searchParams.set('limit', '100');
    const subscriptions = await stripeList<StripeSubscription>(subscriptionsUrl, secret);
    if (subscriptions.some((subscription) => {
      if (subscription.status !== 'active' && subscription.status !== 'trialing') return false;
      // New checkouts bind to the Firebase UID. Legacy subscriptions can be
      // matched by email only after Firebase verifies control of that email.
      const owner = subscription.metadata?.signal87_uid;
      if (owner) return owner === uid;
      return emailVerified && subscription.items?.data?.some((item) => allowedPrices.includes(item.price?.id || '')) === true;
    })) return true;
  }
  return false;
}
