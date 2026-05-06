import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';
import { loadFreshnessSummary } from '@/lib/source-data';

export async function GET() {
  const [countries, freshness] = await Promise.all([restCountriesProvider.getCountries(), loadFreshnessSummary()]);
  return NextResponse.json({
    data: countries.data,
    mode: countries.status,
    source: countries.source,
    freshness,
    dataIntegrity: countries.status === 'live' ? 'Public provider baseline active' : 'Demo fallback active where live baseline is unavailable'
  });
}
