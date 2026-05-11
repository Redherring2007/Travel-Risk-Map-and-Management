import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';
import { loadPersistedCountry, sourceTransparency } from '@/lib/source-data';

export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const persisted = await loadPersistedCountry(iso);
  if (persisted) {
    const transparency = await sourceTransparency('neon-persisted', false, persisted.iso2);
    return NextResponse.json({ data: persisted, mode: 'persisted', source: 'Neon persisted provider bootstrap', dataIntegrity: persisted.verifiedDataStatus, ...transparency });
  }
  const result = await restCountriesProvider.getCountries();
  const normalized = iso.toLowerCase();
  const country = result.data.find((item) => item.iso2.toLowerCase() === normalized || item.iso3.toLowerCase() === normalized || item.name.toLowerCase() === normalized);
  if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 });
  const transparency = await sourceTransparency(result.status === 'live' ? 'live-provider-refresh' : 'fallback-demo', result.status !== 'live', country.iso2);
  return NextResponse.json({ data: country, mode: result.status, source: result.source, dataIntegrity: country.verifiedDataStatus, ...transparency });
}
