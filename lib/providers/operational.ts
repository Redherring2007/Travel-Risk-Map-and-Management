import { fallbackResult, fetchJson, fetchText, providerKeyFor, severityFromText, type ProviderResult } from './shared';

function textItem(provider: string, providerKey: string, title: string, summary: string, url: string, countryIso2?: string) {
  return {
    id: `${providerKey}-${Buffer.from(`${title}-${countryIso2 ?? 'global'}`).toString('base64url').slice(0, 18)}`,
    provider,
    providerKey,
    title,
    countryIso2,
    category: 'Live Travel Intelligence',
    severity: severityFromText(`${title} ${summary}`),
    summary,
    recommendedAction: 'Review source and update itinerary guidance if relevant.',
    url,
    publishedAt: new Date().toISOString(),
    sourceStatus: 'live' as const,
    confidence: 'Medium' as const,
    rawPayload: { title, summary, url }
  };
}

function rssItems(provider: string, url: string, xml: string, countryIso2?: string) {
  const providerKey = providerKeyFor(provider);
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? xml.match(/<entry[\s\S]*?<\/entry>/g) ?? [];
  return blocks.slice(0, 40).map((block, index) => {
    const strip = (value: string) => value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const title = strip(block.match(/<title[\s\S]*?<\/title>/)?.[0] ?? `${provider} update`);
    const summary = strip(block.match(/<description[\s\S]*?<\/description>/)?.[0] ?? block.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? `${provider} item received.`);
    const link = strip(block.match(/<link[^>]*href=["']([^"']+)/)?.[1] ?? block.match(/<link[\s\S]*?<\/link>/)?.[0] ?? url);
    const published = strip(block.match(/<pubDate[\s\S]*?<\/pubDate>/)?.[0] ?? block.match(/<updated[\s\S]*?<\/updated>/)?.[0] ?? new Date().toISOString());
    return { ...textItem(provider, providerKey, title || `${provider} update ${index + 1}`, summary, link || url, countryIso2), publishedAt: published || new Date().toISOString() };
  });
}

export async function fetchNzMfatAdvice(countryIso2?: string): Promise<ProviderResult> {
  const url = process.env.NZ_MFAT_ADVISORY_API_URL;
  const provider = 'New Zealand MFAT';
  if (!url) return fallbackResult(provider, 'NZ_MFAT_ADVISORY_API_URL', 'Set NZ_MFAT_ADVISORY_API_URL to enable MFAT advisory ingestion.', countryIso2, 'nz-mfat');
  try {
    const text = await fetchText(url);
    return { provider, providerKey: 'nz-mfat', status: 'live', source: url, url, fetchedAt: new Date().toISOString(), message: 'MFAT feed active.', errors: [], requiredForRisk: true, items: rssItems(provider, url, text, countryIso2) };
  } catch (error) {
    return { ...fallbackResult(provider, url, `MFAT feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, 'nz-mfat'), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}

export async function fetchGdacsAlerts(countryIso2?: string): Promise<ProviderResult> {
  const url = process.env.DISASTER_FEED_URL || 'https://www.gdacs.org/xml/rss.xml';
  const provider = 'GDACS disaster alerts';
  try {
    const xml = await fetchText(url, 1800);
    return { provider, providerKey: 'gdacs', status: 'live', source: url, url, fetchedAt: new Date().toISOString(), message: 'GDACS public feed active.', errors: [], requiredForRisk: true, items: rssItems(provider, url, xml, countryIso2).map((item) => ({ ...item, category: 'Natural hazard' })) };
  } catch (error) {
    return { ...fallbackResult(provider, url, `GDACS feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, 'gdacs'), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}

export async function fetchUsgsEarthquakes(countryIso2?: string): Promise<ProviderResult> {
  const url = process.env.USGS_EARTHQUAKE_FEED_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson';
  const provider = 'USGS earthquakes';
  try {
    const data = await fetchJson(url, 1800) as { features?: Array<{ id?: string; properties?: Record<string, unknown> }> };
    const items = (data.features ?? []).slice(0, 40).map((feature, index) => {
      const props = feature.properties ?? {};
      const title = String(props.title ?? `USGS earthquake ${index + 1}`);
      const summary = `Magnitude ${String(props.mag ?? 'unknown')} earthquake. ${String(props.place ?? '')}`.trim();
      return { ...textItem(provider, 'usgs', title, summary, String(props.url ?? url), countryIso2), id: `usgs-${String(feature.id ?? index)}`, category: 'Natural hazard', rawPayload: feature };
    });
    return { provider, providerKey: 'usgs', status: 'live', source: url, url, fetchedAt: new Date().toISOString(), message: 'USGS public feed active.', errors: [], requiredForRisk: true, items };
  } catch (error) {
    return { ...fallbackResult(provider, url, `USGS feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, 'usgs'), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}

export async function fetchHealthAlerts(countryIso2?: string): Promise<ProviderResult> {
  const url = process.env.HEALTH_OUTBREAK_FEED_URL;
  const provider = 'Health outbreak feeds';
  if (!url) return fallbackResult(provider, 'HEALTH_OUTBREAK_FEED_URL', 'Set HEALTH_OUTBREAK_FEED_URL to enable WHO/CDC or other outbreak feed ingestion.', countryIso2, 'health');
  try {
    const text = await fetchText(url, 3600);
    return { provider, providerKey: 'health', status: 'live', source: url, url, fetchedAt: new Date().toISOString(), message: 'Configured health feed active.', errors: [], requiredForRisk: true, items: rssItems(provider, url, text, countryIso2).map((item) => ({ ...item, category: 'Health' })) };
  } catch (error) {
    return { ...fallbackResult(provider, url, `Health feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, 'health'), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}

export async function fetchGdeltEvents(countryIso2?: string): Promise<ProviderResult> {
  const url = process.env.GDELT_API_URL;
  const provider = 'GDELT/news events';
  if (!url) return fallbackResult(provider, 'GDELT_API_URL', 'Set GDELT_API_URL to enable news/event ingestion.', countryIso2, 'gdelt');
  try {
    const data = await fetchJson(url, 1800);
    const articles = Array.isArray(data?.articles) ? data.articles : Array.isArray(data?.results) ? data.results : [];
    const items = articles.slice(0, 40).map((article: Record<string, unknown>, index: number) => {
      const title = String(article.title ?? article.seendate ?? `GDELT event ${index + 1}`);
      const summary = String(article.summary ?? article.domain ?? 'GDELT/news item received.');
      return { ...textItem(provider, 'gdelt', title, summary, String(article.url ?? url), countryIso2), category: 'Live Travel Intelligence', rawPayload: article };
    });
    return { provider, providerKey: 'gdelt', status: 'live', source: url, url, fetchedAt: new Date().toISOString(), message: 'Configured GDELT feed active.', errors: [], requiredForRisk: false, items };
  } catch (error) {
    return { ...fallbackResult(provider, url, `GDELT feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2, 'gdelt'), status: 'unavailable', errors: [error instanceof Error ? error.message : 'unknown error'] };
  }
}

export async function fetchAviationDisruption(countryIso2?: string): Promise<ProviderResult> {
  const key = process.env.AVIATIONSTACK_API_KEY;
  const provider = 'Aviation disruption';
  if (!key) return fallbackResult(provider, 'AVIATIONSTACK_API_KEY', 'Set AVIATIONSTACK_API_KEY to enable aviation disruption ingestion.', countryIso2, 'aviation');
  return { ...fallbackResult(provider, 'AVIATIONSTACK_API_KEY', 'Aviation provider key is configured; endpoint mapping remains placeholder until route/airport scope is selected.', countryIso2, 'aviation'), status: 'demo_fallback', errors: [] };
}
