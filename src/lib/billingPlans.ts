export type BillingPlan = 'pro_100' | 'unlimited';

/** Only these server configured prices may be sent to Stripe Checkout. */
export function checkoutPriceForPlan(plan: unknown, prices: { pro100?: string; unlimited?: string }): string | null {
  if (plan === 'pro_100') return prices.pro100 || null;
  if (plan === 'unlimited') return prices.unlimited || null;
  return null;
}
