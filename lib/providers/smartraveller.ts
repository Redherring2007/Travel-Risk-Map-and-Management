import { fallbackResult, fetchText, type ProviderResult } from './shared';

function stripXml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchSmartravellerAdvice(countryIso2?: string): Promise<ProviderResult> {
  const configured = process.env.AU_SMARTRAVELLER_API_URL;
  if (!configured) return fallbackResult('Australia Smartraveller', 'AU_SMARTRAVELLER_API_URL', 'Set AU_SMARTRAVELLER_API_URL to enable Smartraveller destination/RSS ingestion.', countryIso2);
  try {
    const xml = await fetchText(configured);
    const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
    return {
      provider: 'Australia Smartraveller', status: 'live', source: configured, fetchedAt: new Date().toISOString(), message: 'Configured Smartraveller feed active.',
      items: itemBlocks.slice(0, 50).map((block, index) => {
        const title = stripXml(block.match(/<title[\s\S]*?<\/title>/)?.[0] ?? 'Smartraveller update');
        const summary = stripXml(block.match(/<description[\s\S]*?<\/description>/)?.[0] ?? 'Smartraveller advisory item received.');
        const link = stripXml(block.match(/<link[\s\S]*?<\/link>/)?.[0] ?? configured);
        const published = stripXml(block.match(/<pubDate[\s\S]*?<\/pubDate>/)?.[0] ?? new Date().toISOString());
        return { id: `smartraveller-${index}`, provider: 'Australia Smartraveller', title, countryIso2, category: 'Travel advisory', summary, url: link, publishedAt: published, sourceStatus: 'live' as const, confidence: 'High' as const };
      })
    };
  } catch (error) {
    return fallbackResult('Australia Smartraveller', configured, `Smartraveller feed unavailable: ${error instanceof Error ? error.message : 'unknown error'}`, countryIso2);
  }
}
