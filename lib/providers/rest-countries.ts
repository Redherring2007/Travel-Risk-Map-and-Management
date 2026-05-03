import { restCountriesProvider } from '@/lib/provider-adapters';
import type { ProviderResult } from './shared';

export async function fetchRestCountriesBaseline(): Promise<ProviderResult> {
  const result = await restCountriesProvider.getCountries();
  return {
    provider: 'REST Countries',
    status: result.status === 'live' ? 'live' : 'demo_fallback',
    source: result.source,
    fetchedAt: new Date().toISOString(),
    message: result.status === 'live' ? 'Public baseline country data connected.' : 'Using local country fallback data.',
    items: result.data.slice(0, 25).map((country) => ({
      id: `rest-countries-${country.iso2}`,
      provider: 'REST Countries',
      title: `${country.name} baseline profile`,
      countryIso2: country.iso2,
      country: country.name,
      category: 'Country baseline',
      summary: `Capital ${country.capital}; region ${country.region}; population ${country.population}.`,
      publishedAt: new Date().toISOString(),
      sourceStatus: result.status === 'live' ? 'live' : 'demo',
      confidence: result.status === 'live' ? 'High' : 'Medium'
    }))
  };
}
