import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';
import { generateAndSaveOperationalReport, getLatestTripAssessment } from '@/lib/trip-assessment';

const schema = z.object({ tripId: z.string().min(1) });

export async function POST(request: Request) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const trip = await store.getTrip(parsed.data.tripId);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  if (trip.userId !== user.id && user.role !== 'admin') return NextResponse.json({ error: 'Trip access denied' }, { status: 403 });

  const latestAssessment = await getLatestTripAssessment(trip.id);
  const result = await generateAndSaveOperationalReport(trip, latestAssessment ?? undefined);
  return NextResponse.json({ data: result.report, assessment: result.assessment, ai: result.ai }, { status: 201 });
}
