import { NextResponse } from 'next/server';
import { getSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';
import { assessTripRisk } from '@/lib/trip-assessment';
import { sourceTransparency } from '@/lib/source-data';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });

  const { id } = await params;
  const trip = await store.getTrip(id);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.userId !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Trip access denied' }, { status: 403 });

  const assessment = await assessTripRisk(trip);
  const primary = trip.locations[0];
  const transparency = await sourceTransparency('neon-persisted-first', false, primary?.countryIso2);
  return NextResponse.json({ data: assessment, ...transparency });
}
