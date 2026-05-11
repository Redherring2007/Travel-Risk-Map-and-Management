import { fallbackResult, fetchJson, type ProviderItem, type ProviderResult } from './shared';

function sparqlUrl(query: string) {
  return `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`;
}

export async function fetchWikidataCountryContext(countryIso2?: string): Promise<ProviderResult> {
  const provider = 'Wikidata country context';
  const providerKey = 'wikidata';
  if (!countryIso2) return fallbackResult(provider, 'https://query.wikidata.org', 'Wikidata ingestion requires a countryIso2 scope.', countryIso2, providerKey);
  const query = `
SELECT ?country ?countryLabel ?governmentLabel ?timezoneLabel ?emergencyNumber ?airportLabel ?hospitalLabel WHERE {
  ?country wdt:P297 "${countryIso2.toUpperCase()}" .
  OPTIONAL { ?country wdt:P122 ?government . }
  OPTIONAL { ?country wdt:P421 ?timezone . }
  OPTIONAL { ?country wdt:P2852 ?emergencyNumber . }
  OPTIONAL { ?airport wdt:P17 ?country; wdt:P31/wdt:P279* wd:Q1248784 . }
  OPTIONAL { ?hospital wdt:P17 ?country; wdt:P31/wdt:P279* wd:Q16917 . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 50`;
  const url = sparqlUrl(query);
  try {
    const data = await fetchJson(url, 86400) as { results?: { bindings?: Array<Record<string, { value?: string }>> } };
    const bindings = data.results?.bindings ?? [];
    const labels = (field: string) => Array.from(new Set(bindings.map((row) => row[field]?.value).filter(Boolean))).slice(0, 15);
    const summary = [
      `Government: ${labels('governmentLabel').join(', ') || 'Limited verified data available'}`,
      `Timezone: ${labels('timezoneLabel').join(', ') || 'Limited verified data available'}`,
      `Emergency numbers: ${labels('emergencyNumber').join(', ') || 'Limited verified data available'}`,
      `Major airports: ${labels('airportLabel').slice(0, 5).join(', ') || 'Limited verified data available'}`,
      `Hospitals: ${labels('hospitalLabel').slice(0, 5).join(', ') || 'Limited verified data available'}`
    ].join('; ');
    const item: ProviderItem = { id: `wikidata-${countryIso2}`, provider, providerKey, title: `${countryIso2} Wikidata country context`, countryIso2, category: 'Country master profile', severity: 'Low', summary, recommendedAction: 'Use as public structured context and verify critical fields against official sources.', url, publishedAt: new Date().toISOString(), sourceStatus: 'live', confidence: 'Medium', rawPayload: data };
    return { provider, providerKey, status: 'live', source: 'Wikidata SPARQL public endpoint', url, fetchedAt: new Date().toISOString(), message: 'Wikidata public context fetched.', errors: [], requiredForRisk: false, items: [item] };
  } catch (error) {
    return { ...fallbackResult(provider, 'https://query.wikidata.org', `Wikidata unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, providerKey), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}
