import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';
import { calculateCountryRiskFromSources } from '@/lib/risk-engine';
import { loadFreshnessSummary, loadRelevantAdvisories, loadRelevantEvents } from '@/lib/source-data';

export async function GET(_request: Request, { params }: { params: Promise<{ iso: string }> }) {
  const { iso } = await params;
  const result = await restCountriesProvider.getCountries();
  const normalized = iso.toLowerCase();
  const country = result.data.find((item) => item.iso2.toLowerCase() === normalized || item.iso3.toLowerCase() === normalized || item.name.toLowerCase() === normalized);
  if (!country) return NextResponse.json({ error: 'Country not found' }, { status: 404 });

  const [advisories, events, freshness] = await Promise.all([
    loadRelevantAdvisories(country.iso2),
    loadRelevantEvents(country.iso2),
    loadFreshnessSummary()
  ]);
  const assessment = calculateCountryRiskFromSources({ country, advisories, events, sourceSummary: freshness });
  return NextResponse.json({
    data: country,
    assessment,
    advisories,
    events,
    freshness,
    mode: result.status,
    source: result.source,
    dataIntegrity: country.verifiedDataStatus
  });
}
