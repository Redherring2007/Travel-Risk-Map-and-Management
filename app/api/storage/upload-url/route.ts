import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession, requirePaid } from '@/lib/auth';
import { createSignedUploadUrl, getStorageBucket, isStorageConfigured } from '@/lib/storage';

const schema = z.object({ tripId: z.string().min(1), fileName: z.string().min(1), contentType: z.string().default('application/octet-stream') });

export async function POST(request: Request) {
  const user = getSession(request.headers);
  const paid = requirePaid(user);
  if (!paid.ok) return NextResponse.json({ error: paid.message }, { status: paid.status });
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const key = `users/${user.id}/trips/${parsed.data.tripId}/${Date.now()}-${parsed.data.fileName}`;
  if (!isStorageConfigured()) {
    return NextResponse.json({ mode: 'demo-storage', configured: false, key, bucket: process.env.S3_BUCKET ?? 'not-configured', uploadUrl: null, note: 'Configure S3/R2/MinIO env vars to receive a signed upload URL.' });
  }
  return NextResponse.json({ mode: 'signed-url', configured: true, key, bucket: getStorageBucket(), uploadUrl: await createSignedUploadUrl({ key, contentType: parsed.data.contentType }) });
}
