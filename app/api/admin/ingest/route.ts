import { NextResponse } from 'next/server';
import { requireIngestionAccess } from '@/lib/admin-protection';
import { runIngestion } from '@/lib/ingestion';

export async function POST(request: Request) {
  const access = requireIngestionAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
  const body = await request.json().catch(() => ({}));
  const result = await runIngestion({
    providers: Array.isArray(body.providers) ? body.providers : undefined,
    countryIso2: typeof body.countryIso2 === 'string' ? body.countryIso2 : undefined,
    cityId: typeof body.cityId === 'string' ? body.cityId : undefined
  });
  return NextResponse.json({ protectedBy: access.mode, ...result });
}
