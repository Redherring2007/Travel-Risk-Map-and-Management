import { fallbackResult, fetchJson, type ProviderResult } from './shared';

export async function fetchCanadaTravelAdvice(countryIso2?: string): Promise<ProviderResult> {
  const configured = process.env.CANADA_ADVISORY_API_URL;
  if (!configured) return fallbackResult('Canada Travel Advice', 'CANADA_ADVISORY_API_URL', 'Set CANADA_ADVISORY_API_URL to enable Canada travel advisory ingestion.', countryIso2);
  try {
    const data = await fetchJson(configured);
    const items = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
    return {
      provider: 'Canada Travel Advice', status: 'live', source: configured, fetchedAt: new Date().toISOString(), message: 'Configured Canada advisory feed active.',
      items: items.slice(0, 50).map((item: Record<string, unknown>, index: number) => ({
        id: `canada-${String(item.id ?? index)}`,
        provider: 'Canada Travel Advice', title: String(item.title ?? item.country ?? 'Canada travel advice update'), countryIso2, category: 'Travel advisory',
        summary: String(item.summary ?? item.description ?? item.advice ?? 'Canada advisory item received.'), url: String(item.link ?? item.url ?? configured),
        publishedAt: String(item.updated ?? item.pubDate ?? new Date().toISOString()), sourceStatus: 'live', confidence: 'High'
      }))
    };
  } catch (error) {
    return fallbackResult('Canada Travel Advice', configured, `Canada advisory feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2);
  }
}
