import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requirePaid } from '@/lib/auth';
import { generateTripReport } from '@/lib/report';
import { store } from '@/lib/store';

const schema = z.object({ tripId: z.string().min(1) });

export async function POST(request: Request) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const trip = await store.getTrip(parsed.data.tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  const report = generateTripReport(trip, await store.listDocuments(trip.id));
  const saved = await store.saveReport(report);
  return NextResponse.json({ data: saved }, { status: 201 });
}
