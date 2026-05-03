import { NextResponse } from 'next/server';
import { cities } from '@/lib/data';
import { requireIngestionAccess } from '@/lib/admin-protection';
import { runIngestion } from '@/lib/ingestion';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = requireIngestionAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
  const { id } = await params;
  const city = cities.find((item) => item.id === id);
  const result = await runIngestion({ cityId: id, countryIso2: city?.countryIso2 });
  return NextResponse.json({ protectedBy: access.mode, ...result });
}
