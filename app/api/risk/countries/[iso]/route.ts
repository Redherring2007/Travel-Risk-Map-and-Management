import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';
import { mergeCountryProfile } from '@/lib/country-profile-merge';
import { calculateCountryRiskFromSources } from '@/lib/risk-engine';
import { loadFreshnessSummary, loadPersistedCountry, loadRelevantAdvisories, loadRelevantEvents, sourceTransparency } from '@/lib/source-data';

export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const persisted = await loadPersistedCountry(iso);
  let country = persisted;
  let mode = 'persisted';
  let source = 'Neon persisted provider bootstrap';
  if (!country) {
    const result = await restCountriesProvider.getCountries();
    const normalized = iso.toLowerCase();
    country = result.data.find((item) => item.iso2.toLowerCase() === normalized || item.iso3.toLowerCase() === normalized || item.name.toLowerCase() === normalized) ?? null;
    mode = result.status;
    source = result.source;
  }
  if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 });

  const [advisories, events, freshness, mergedProfile, transparency] = await Promise.all([
    loadRelevantAdvisories(country.iso2),
    loadRelevantEvents(country.iso2),
    loadFreshnessSummary(),
    mergeCountryProfile(country.iso2),
    sourceTransparency(persisted ? 'neon-persisted' : mode === 'live' ? 'live-provider-refresh' : 'fallback-demo', !persisted && mode !== 'live', country.iso2)
  ]);
  const assessment = calculateCountryRiskFromSources({ country, advisories, events, sourceSummary: freshness });
  return NextResponse.json({
    data: country,
    assessment,
    advisories,
    events,
    freshness,
    mergedProfile,
    mode,
    source,
    dataIntegrity: country.verifiedDataStatus,
    ...transparency
  });
}
