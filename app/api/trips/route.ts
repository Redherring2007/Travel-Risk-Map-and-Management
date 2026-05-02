import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDemoSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';

const travellerSchema = z.object({
  nationality: z.string().min(1),
  gender: z.string().default('Not specified'),
  travelStyle: z.enum(['solo', 'family', 'corporate', 'executive']).default('corporate'),
  highProfile: z.boolean().default(false),
  medicalConsiderations: z.string().default(''),
  riskTolerance: z.enum(['low', 'medium', 'high']).default('medium'),
  purpose: z.string().default('Business'),
  childrenTravelling: z.boolean().default(false),
  hostileEnvironmentSupport: z.boolean().default(false)
});

const tripSchema = z.object({
  name: z.string().min(1),
  traveller: travellerSchema,
  locations: z.array(z.object({ countryIso2: z.string(), country: z.string(), city: z.string(), arrivalDate: z.string(), departureDate: z.string() })).min(1),
  accommodation: z.string().default(''),
  flightDetails: z.string().default(''),
  internalMovements: z.string().default(''),
  meetingsEvents: z.string().default('')
});

export async function GET(request: Request) {
  const user = getDemoSession(request.headers);
  return NextResponse.json({ data: store.listTrips(user.id) });
}

export async function POST(request: Request) {
  const user = getDemoSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const parsed = tripSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const trip = store.createTrip({ ...parsed.data, userId: user.id, paid: true });
  return NextResponse.json({ data: trip }, { status: 201 });
}
