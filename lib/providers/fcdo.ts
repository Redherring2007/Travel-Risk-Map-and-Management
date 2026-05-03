import { fallbackResult, fetchJson, type ProviderResult } from './shared';

export async function fetchFcdoAdvice(countryIso2?: string): Promise<ProviderResult> {
  const configured = process.env.UK_FCDO_API_URL;
  if (!configured) return fallbackResult('UK FCDO', 'UK_FCDO_API_URL', 'Set UK_FCDO_API_URL to enable GOV.UK/FCDO advisory ingestion.', countryIso2);
  try {
    const data = await fetchJson(configured);
    const items = Array.isArray(data?.items) ? data.items : Array.isArray(data?.results) ? data.results : [];
    return {
      provider: 'UK FCDO', status: 'live', source: configured, fetchedAt: new Date().toISOString(), message: 'Live configured GOV.UK/FCDO feed active.',
      items: items.slice(0, 50).map((item: Record<string, unknown>, index: number) => ({
        id: `fcdo-${String(item.id ?? index)}`,
        provider: 'UK FCDO', title: String(item.title ?? 'FCDO travel advice update'), countryIso2, category: 'Travel advisory',
        summary: String(item.description ?? item.summary ?? item.content ?? 'FCDO advisory item received.'), url: String(item.link ?? item.url ?? configured),
        publishedAt: String(item.pubDate ?? item.updated_at ?? item.date ?? new Date().toISOString()), sourceStatus: 'live', confidence: 'High'
      }))
    };
  } catch (error) {
    return fallbackResult('UK FCDO', configured, `FCDO feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2);
  }
}
