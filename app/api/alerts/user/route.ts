import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { store } from '@/lib/store';

export async function GET(request: Request) {
  const user = getSession(request.headers);
  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get('tripId');
  const alerts = (await store.listAlerts()).filter((alert) => alert.approved !== false);
  return NextResponse.json({ data: tripId ? alerts.filter((alert) => alert.linkedTripId === tripId || !alert.linkedTripId) : alerts, user: user.email });
}
