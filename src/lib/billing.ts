/**
 * Client half of billing: fetch what is on sale, and hand the browser to
 * Stripe.
 *
 * There is no Stripe.js here on purpose. Checkout Sessions return a URL, so a
 * plain redirect does the whole job — no third-party script on every page load,
 * which is the same reasoning that keeps the fonts and the PDF worker local.
 */
import { auth } from './firebase';

export interface Plan {
  priceId: string;
  name: string;
  description: string | null;
  features: string[];
  unitAmount: number | null;
  currency: string;
  interval: string | null;
  intervalCount: number;
}

export interface PlansResult {
  plans: Plan[];
  /** False when the deployment has no Stripe key yet. */
  configured: boolean;
}

async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to continue.');
  return { Authorization: `Bearer ${await user.getIdToken()}` };
}

export async function fetchPlans(): Promise<PlansResult> {
  try {
    const response = await fetch('/api/billing/plans');
    if (!response.ok) return { plans: [], configured: false };
    const data: unknown = await response.json();
    const parsed = data as Partial<PlansResult>;
    return { plans: Array.isArray(parsed.plans) ? parsed.plans : [], configured: parsed.configured === true };
  } catch {
    return { plans: [], configured: false };
  }
}

/** Sends the browser to Stripe Checkout. Resolves only if it failed to start. */
export async function startCheckout(priceId: string): Promise<never | void> {
  const response = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify({ priceId })
  });
  const data: { url?: string; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || 'Could not start checkout.');
  window.location.assign(data.url);
}

/** Opens Stripe's own billing portal, where a customer can cancel or swap card. */
export async function openBillingPortal(): Promise<never | void> {
  const response = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) }
  });
  const data: { url?: string; error?: string } = await response.json().catch(() => ({}));
  if (!response.ok || !data.url) throw new Error(data.error || 'Could not open the billing portal.');
  window.location.assign(data.url);
}

/** "$49 / month", from Stripe's own numbers — never a hardcoded price. */
export function formatPrice(plan: Plan): string {
  if (plan.unitAmount === null) return 'Contact us';
  const amount = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: plan.currency.toUpperCase(),
    // Whole-dollar prices read better without the trailing .00.
    minimumFractionDigits: plan.unitAmount % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(plan.unitAmount / 100);
  if (!plan.interval) return amount;
  const period = plan.intervalCount > 1 ? `${plan.intervalCount} ${plan.interval}s` : plan.interval;
  return `${amount} / ${period}`;
}
