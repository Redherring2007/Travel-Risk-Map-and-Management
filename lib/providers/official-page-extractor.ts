import { fallbackResult, fetchText, type ProviderItem, type ProviderResult } from './shared';

type PageSpec = { countryIso2?: string; url: string };

function parseSpecs(countryIso2?: string): PageSpec[] {
  const configured = process.env.OFFICIAL_PAGE_URLS;
  if (!configured) return [];
  return configured.split(',').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [maybeIso, maybeUrl] = entry.split('|').map((part) => part.trim());
    if (maybeUrl) return { countryIso2: maybeIso.toUpperCase(), url: maybeUrl };
    return { countryIso2, url: maybeIso };
  }).filter((spec) => !countryIso2 || !spec.countryIso2 || spec.countryIso2 === countryIso2.toUpperCase()).slice(0, 8);
}

function isOfficialPublicUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.endsWith('.gov') || host.endsWith('.gov.uk') || host.endsWith('.gc.ca') || host.endsWith('.gouv.fr') || host.endsWith('.gov.au') || host.endsWith('.govt.nz') || host.includes('who.int') || host.includes('cdc.gov') || host.includes('state.gov') || host.includes('gov.uk');
  } catch { return false; }
}

function stripHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 12000);
}

export async function fetchOfficialPageExtractions(countryIso2?: string): Promise<ProviderResult> {
  const provider = 'Official public page extractor';
  const providerKey = 'official-page-extractor';
  const specs = parseSpecs(countryIso2);
  if (!specs.length) return fallbackResult(provider, 'OFFICIAL_PAGE_URLS', 'Set OFFICIAL_PAGE_URLS to comma-separated official URLs. Optional format: ISO2|https://official.example/page', countryIso2, providerKey);

  const items: ProviderItem[] = [];
  const errors: string[] = [];
  for (const spec of specs) {
    if (!isOfficialPublicUrl(spec.url)) {
      errors.push(`Skipped non-official URL: ${spec.url}`);
      continue;
    }
    try {
      const html = await fetchText(spec.url, 86400);
      const text = stripHtml(html);
      items.push({ id: `official-${Buffer.from(spec.url).toString('base64url').slice(0, 18)}`, provider, providerKey, title: `Official page extraction: ${spec.url}`, countryIso2: spec.countryIso2, category: 'Official page extraction', severity: 'Low', summary: text ? text.slice(0, 500) : 'Limited verified data available.', recommendedAction: 'Use extracted official text as source material only; do not infer unsupported structured facts.', url: spec.url, publishedAt: new Date().toISOString(), sourceStatus: 'live', confidence: 'Medium', rawPayload: { url: spec.url, extractedText: text, extractionMethod: 'controlled-public-page-fetch' } });
    } catch (error) {
      errors.push(`${spec.url}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  return { provider, providerKey, status: items.length ? 'live' : 'unavailable', source: 'Configured official public pages', fetchedAt: new Date().toISOString(), message: items.length ? 'Official pages extracted conservatively.' : 'No official pages could be extracted.', errors, requiredForRisk: false, items };
}
