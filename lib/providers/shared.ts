import type { Confidence, RiskLevel } from '@/lib/types';

export type ProviderItem = {
  id: string;
  provider: string;
  providerKey?: string;
  title: string;
  countryIso2?: string;
  country?: string;
  city?: string;
  category: string;
  severity?: RiskLevel;
  summary: string;
  recommendedAction?: string;
  url?: string;
  publishedAt: string;
  sourceStatus: 'live' | 'demo' | 'limited';
  confidence: Confidence;
  rawPayload?: unknown;
};

export type ProviderResult = {
  provider: string;
  providerKey?: string;
  status: 'live' | 'demo_fallback' | 'missing_key' | 'unavailable';
  source: string;
  url?: string;
  fetchedAt: string;
  items: ProviderItem[];
  message: string;
  errors?: string[];
  requiredForRisk?: boolean;
};

export function providerKeyFor(provider: string) {
  return provider.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'provider';
}

export function severityFromText(value = ''): RiskLevel {
  const text = value.toLowerCase();
  if (/(do not travel|avoid|critical|severe|war|missile|evacuat)/.test(text)) return 'Critical';
  if (/(reconsider|high|terror|kidnap|violent|earthquake|cyclone|hurricane|conflict)/.test(text)) return 'High';
  if (/(increased caution|moderate|protest|strike|disrupt|health alert|watch)/.test(text)) return 'Moderate';
  return 'Low';
}

export function confidenceFromStatus(status: 'live' | 'demo' | 'limited'): Confidence {
  if (status === 'live') return 'High';
  if (status === 'limited') return 'Medium';
  return 'Low';
}

export function fallbackResult(provider: string, source: string, message: string, countryIso2?: string, providerKey = providerKeyFor(provider)): ProviderResult {
  return {
    provider,
    providerKey,
    status: 'demo_fallback',
    source,
    url: source.startsWith('http') ? source : undefined,
    fetchedAt: new Date().toISOString(),
    message,
    errors: [],
    requiredForRisk: false,
    items: [{
      id: `${providerKey}-${countryIso2 ?? 'global'}-fallback`,
      provider,
      providerKey,
      title: 'Demo fallback active',
      countryIso2,
      category: 'Provider status',
      severity: 'Moderate',
      summary: 'Live provider data is not connected or was unavailable. Atlas Insight is showing labelled fallback intelligence only.',
      recommendedAction: 'Connect provider credentials or URLs before operational reliance.',
      publishedAt: new Date().toISOString(),
      sourceStatus: 'demo',
      confidence: 'Low',
      rawPayload: { message }
    }]
  };
}

export async function fetchJson(url: string, ttlSeconds = 21600) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, next: { revalidate: ttlSeconds } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

export async function fetchText(url: string, ttlSeconds = 1800) {
  const response = await fetch(url, { headers: { accept: 'application/xml,text/xml,text/plain,*/*' }, next: { revalidate: ttlSeconds } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.text();
}
