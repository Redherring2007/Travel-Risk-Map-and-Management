import { NextResponse } from 'next/server';
import { getSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await store.getTrip(id);
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  return NextResponse.json({ data: trip });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id } = await params;
  const trip = await store.updateTrip(id, await request.json());
  if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  return NextResponse.json({ data: trip });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id } = await params;
  await store.deleteTrip(id);
  return NextResponse.json({ ok: true });
}
