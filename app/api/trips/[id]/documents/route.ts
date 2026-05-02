import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDemoSession, requirePaid } from '@/lib/auth';
import { store } from '@/lib/store';

const documentSchema = z.object({ type: z.string().min(1), fileName: z.string().min(1), mimeType: z.string().default('application/octet-stream'), size: z.number().default(0), demoContent: z.string().optional() });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ data: store.listDocuments(id), storageMode: 'demo-memory; production uses S3-compatible object storage plus Neon metadata.' });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = getDemoSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const { id } = await params;
  if (!store.getTrip(id)) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
  const parsed = documentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const doc = store.addDocument({ ...parsed.data, tripId: id, storagePath: `demo/${id}/${parsed.data.fileName}` });
  return NextResponse.json({ data: doc }, { status: 201 });
}
