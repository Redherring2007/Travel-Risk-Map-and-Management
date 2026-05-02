import { query, isNeonConfigured } from './neon';

export function isStripeConfigured() {
  return Boolean(process.env.STRIPE_PUBLIC_KEY && process.env.STRIPE_SECRET_KEY);
}

export async function markSubscriptionActive(input: { userId: string; customerId?: string; subscriptionId?: string; priceId?: string }) {
  if (!isNeonConfigured()) return { mode: 'demo', updated: false };
  await query('insert into users (id, email, role) values ($1, $2, $3) on conflict (id) do update set role = $3, updated_at = now()', [input.userId, `${input.userId}@atlasinsight.local`, 'client']);
  await query(
    `insert into subscriptions (user_id, provider, provider_customer_id, provider_subscription_id, status, price_id)
     values ($1, 'stripe', $2, $3, 'active', $4)
     on conflict (id) do nothing`,
    [input.userId, input.customerId ?? null, input.subscriptionId ?? null, input.priceId ?? null]
  );
  return { mode: 'neon', updated: true };
}
