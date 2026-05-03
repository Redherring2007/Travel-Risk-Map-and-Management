export type ProviderItem = {
  id: string;
  provider: string;
  title: string;
  countryIso2?: string;
  country?: string;
  city?: string;
  category: string;
  severity?: string;
  summary: string;
  url?: string;
  publishedAt: string;
  sourceStatus: 'live' | 'demo' | 'limited';
  confidence: 'Low' | 'Medium' | 'High';
};

export type ProviderResult = {
  provider: string;
  status: 'live' | 'demo_fallback' | 'missing_key' | 'unavailable';
  source: string;
  fetchedAt: string;
  items: ProviderItem[];
  message: string;
};

export function fallbackResult(provider: string, source: string, message: string, countryIso2?: string): ProviderResult {
  return {
    provider,
    status: 'demo_fallback',
    source,
    fetchedAt: new Date().toISOString(),
    message,
    items: [{
      id: `${provider.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${countryIso2 ?? 'global'}-fallback`,
      provider,
      title: 'Demo fallback active',
      countryIso2,
      category: 'Provider status',
      severity: 'Moderate',
      summary: 'Live provider data is not connected or was unavailable. Atlas Insight is showing labelled fallback intelligence only.',
      publishedAt: new Date().toISOString(),
      sourceStatus: 'demo',
      confidence: 'Low'
    }]
  };
}

export async function fetchJson(url: string) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: 21600 } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export async function fetchText(url: string) {
  const response = await fetch(url, { headers: { accept: 'application/xml,text/xml,text/plain,*/*' }, next: { revalidate: 1800 } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}
