import { NextResponse } from 'next/server';
import { markSubscriptionActive } from '@/lib/stripe';

export async function POST(request: Request) {
  const payload = await request.json().catch(() => ({}));
  const userId = payload.userId || payload.client_reference_id;
  if (!userId) {
    return NextResponse.json({ ok: true, mode: 'placeholder', note: 'Stripe signature verification and event mapping should be added before production.' });
  }
  const result = await markSubscriptionActive({ userId, customerId: payload.customer, subscriptionId: payload.subscription, priceId: payload.priceId });
  return NextResponse.json({ ok: true, result, accessTier: 'client' });
}
