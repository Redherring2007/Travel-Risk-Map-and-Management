import { NextResponse } from 'next/server';
import { findCountry } from '@/lib/data';

export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const country = findCountry(iso);
  if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 });
  return NextResponse.json({ data: country, dataIntegrity: country.verifiedDataStatus });
}
