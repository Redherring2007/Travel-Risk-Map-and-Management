import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';

const documentSchema = z.object({
  type: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().default('application/octet-stream'),
  size: z.number().default(0),
  storageKey: z.string().optional(),
  demoContent: z.string().optional()
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ data: await store.listDocuments(id), storageMode: 'metadata-only; production file bytes live in S3-compatible storage and Neon stores audit metadata.' });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id } = await params;
  if (!(await store.getTrip(id))) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  const parsed = documentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const storageKey = parsed.data.storageKey ?? `trips/${id}/${Date.now()}-${parsed.data.fileName}`;
  const doc = await store.addDocument({ ...parsed.data, tripId: id, userId: user.id, storageProvider: 'demo', storageBucket: process.env.S3_BUCKET, storageKey });
  return NextResponse.json({ data: doc }, { status: 201 });
}
