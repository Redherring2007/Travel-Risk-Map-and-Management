import { NextResponse } from 'next/server';
import { requireIngestionAccess } from '@/lib/admin-protection';
import { runIngestion } from '@/lib/ingestion';

export async function POST(request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const access = requireIngestionAccess(request);
  if (!access.ok) return NextResponse.json({ error: access.message }, { status: access.status });
  const { iso } = await params;
  const result = await runIngestion({ countryIso2: iso.toUpperCase() });
  return NextResponse.json({ protectedBy: access.mode, ...result });
}
