import { NextResponse } from 'next/server';
import { getDemoSession } from '@/lib/auth';
import { store } from '@/lib/store';

export async function GET(request: Request) {
  const user = getDemoSession(request.headers);
  const { searchParams } = new URL(request.url);
  const tripId = searchParams.get('tripId');
  const alerts = store.listAlerts().filter((alert) => alert.approved !== false);
  return NextResponse.json({ data: tripId ? alerts.filter((alert) => alert.linkedTripId === tripId || !alert.linkedTripId) : alerts, user: user.email });
}
