import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requirePaid } from '@/lib/auth';
import { createSignedDownloadUrl, isStorageConfigured } from '@/lib/storage';

const schema = z.object({ key: z.string().min(1) });

export async function POST(request: Request) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!isStorageConfigured()) {
    return NextResponse.json({ mode: 'demo-storage', configured: false, downloadUrl: null, note: 'Configure S3/R2/MinIO env vars to receive a signed download URL.' });
  }
  return NextResponse.json({ mode: 'signed-url', configured: true, downloadUrl: await createSignedDownloadUrl({ key: parsed.data.key }) });
}
