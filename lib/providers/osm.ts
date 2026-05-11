import { fallbackResult, type ProviderItem, type ProviderResult } from './shared';

const categories = [
  { key: 'hotels', query: 'hotel' },
  { key: 'hospitals', query: 'hospital' },
  { key: 'embassies', query: 'embassy' },
  { key: 'police', query: 'police station' },
  { key: 'airports', query: 'airport' },
  { key: 'transport_hubs', query: 'train station' }
];

async function nominatimSearch(countryIso2: string, query: string) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=${encodeURIComponent(countryIso2.toLowerCase())}&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'user-agent': process.env.OSM_USER_AGENT || 'AtlasInsightTravelRisk/0.1 contact=admin@atlasinsight.local'
    },
    next: { revalidate: 86400 }
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { url, data: await response.json() };
}

export async function fetchOsmPois(countryIso2?: string): Promise<ProviderResult> {
  const provider = 'OpenStreetMap POI context';
  const providerKey = 'osm';
  if (!countryIso2) return fallbackResult(provider, 'https://nominatim.openstreetmap.org', 'OSM POI ingestion requires a countryIso2 scope.', countryIso2, providerKey);
  try {
    const results: Record<string, unknown> = {};
    for (const category of categories) {
      const response = await nominatimSearch(countryIso2, category.query);
      results[category.key] = response;
    }
    const counts = Object.entries(results).map(([key, value]) => `${key}: ${Array.isArray((value as { data?: unknown }).data) ? ((value as { data: unknown[] }).data.length) : 0}`);
    const item: ProviderItem = { id: `osm-${countryIso2}`, provider, providerKey, title: `${countryIso2} OpenStreetMap POIs`, countryIso2, category: 'Location POI context', severity: 'Low', summary: `Public OSM/Nominatim POI candidates fetched. ${counts.join('; ')}`, recommendedAction: 'Verify critical POIs manually before operational use; respect OSM/Nominatim rate limits.', url: 'https://nominatim.openstreetmap.org', publishedAt: new Date().toISOString(), sourceStatus: 'live', confidence: 'Medium', rawPayload: results };
    return { provider, providerKey, status: 'live', source: 'OpenStreetMap Nominatim public API', url: item.url, fetchedAt: new Date().toISOString(), message: 'OSM POI candidates fetched with conservative request volume.', errors: [], requiredForRisk: false, items: [item] };
  } catch (error) {
    return { ...fallbackResult(provider, 'https://nominatim.openstreetmap.org', `OSM unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, providerKey), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}
