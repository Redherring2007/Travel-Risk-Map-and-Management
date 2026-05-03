import { fallbackResult, fetchJson, type ProviderResult } from './shared';

export async function fetchUsStateAdvice(countryIso2?: string): Promise<ProviderResult> {
  const configured = process.env.US_STATE_ADVISORY_API_URL;
  if (!configured) return fallbackResult('US State Department', 'US_STATE_ADVISORY_API_URL', 'Set US_STATE_ADVISORY_API_URL to enable State Department advisory ingestion.', countryIso2);
  try {
    const data = await fetchJson(configured);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
    return {
      provider: 'US State Department', status: 'live', source: configured, fetchedAt: new Date().toISOString(), message: 'Configured US State advisory feed active.',
      items: items.slice(0, 50).map((item: Record<string, unknown>, index: number) => ({
        id: `us-state-${String(item.id ?? index)}`,
        provider: 'US State Department', title: String(item.title ?? 'US travel advisory update'), countryIso2, category: 'Travel advisory',
        summary: String(item.summary ?? item.description ?? item.advisory ?? 'US State advisory item received.'), url: String(item.link ?? item.url ?? configured),
        publishedAt: String(item.pubDate ?? item.updated ?? new Date().toISOString()), sourceStatus: 'live', confidence: 'High'
      }))
    };
  } catch (error) {
    return fallbackResult('US State Department', configured, `US State feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2);
  }
}
