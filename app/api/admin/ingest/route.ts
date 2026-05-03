import { NextResponse } from 'next/server';
import { requireIngestionAccess } from '@/lib/admin-protection';
import { runIngestion } from '@/lib/ingestion';

export async function POST(request: Request) {
  const access = requireIngestionAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const result = await runIngestion({ countryIso2: body.countryIso2, cityId: body.cityId });
  return NextResponse.json({ protectedBy: access.mode, ...result });
}
