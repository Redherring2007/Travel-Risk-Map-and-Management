import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { isStripeConfigured } from '@/lib/stripe';

export async function POST(request: Request) {
  const user = getSession(request.headers);
  if (!isStripeConfigured()) {
    return NextResponse.json({ mode: 'demo-billing', configured: false, checkoutUrl: null, userId: user.id, note: 'Configure STRIPE_PUBLIC_KEY and STRIPE_SECRET_KEY, then replace this placeholder with Stripe Checkout session creation.' });
  }
  return NextResponse.json({ mode: 'stripe-ready-placeholder', configured: true, userId: user.id, note: 'Create a Stripe Checkout session here and return its URL. Webhook updates subscriptions.status to active.' });
}
