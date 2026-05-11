import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';
import { loadPersistedCountries, sourceTransparency } from '@/lib/source-data';

export async function GET() {
  const persisted = await loadPersistedCountries();
  if (persisted.length) {
    const transparency = await sourceTransparency('neon-persisted', false);
    return NextResponse.json({ data: persisted, mode: 'persisted', source: 'Neon persisted provider bootstrap', notes: 'Persisted country data loaded before live/demo fallback.', ...transparency });
  }
  const result = await restCountriesProvider.getCountries();
  const transparency = await sourceTransparency(result.status === 'live' ? 'live-provider-refresh' : 'fallback-demo', result.status !== 'live');
  return NextResponse.json({ data: result.data, mode: result.status, source: result.source, notes: result.notes, ...transparency });
}
