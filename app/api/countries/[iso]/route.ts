import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';

export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const result = await restCountriesProvider.getCountries();
  const normalized = iso.toLowerCase();
  const country = result.data.find((item) => item.iso2.toLowerCase() === normalized || item.iso3.toLowerCase() === normalized || item.name.toLowerCase() === normalized);
  if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 });
  return NextResponse.json({ data: country, mode: result.status, source: result.source, dataIntegrity: country.verifiedDataStatus });
}
