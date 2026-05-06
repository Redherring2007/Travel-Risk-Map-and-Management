import { NextResponse } from 'next/server';
import { searchCities } from '@/lib/data';
import { calculateCityRiskFromSources, calculateCountryRiskFromSources } from '@/lib/risk-engine';
import { loadFreshnessSummary, loadRelevantEvents } from '@/lib/source-data';
import { findCountry } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query') ?? searchParams.get('q') ?? '';
  const countryIso2 = searchParams.get('country') ?? undefined;
  const matches = searchCities(query).filter((city) => !countryIso2 || city.countryIso2 === countryIso2);
  const freshness = await loadFreshnessSummary();
  const data = await Promise.all(matches.map(async (city) => {
    const country = findCountry(city.countryIso2) ?? null;
    const events = await loadRelevantEvents(city.countryIso2, city.name);
    const countryRisk = calculateCountryRiskFromSources({ country, events, sourceSummary: freshness });
    const assessment = calculateCityRiskFromSources({ city, events, countryRisk });
    return { ...city, assessment, events, sourceStatus: city.limitedData ? 'Limited verified data available' : 'Demo/provider-backed city profile' };
  }));
  return NextResponse.json({ data, freshness, mode: 'neon-or-demo-fallback' });
}
