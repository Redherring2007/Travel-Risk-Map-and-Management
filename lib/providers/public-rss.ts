import { fallbackResult, fetchText, type ProviderResult } from './shared';

function strip(value: string) { return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }

export async function fetchPublicRssFeeds(): Promise<ProviderResult> {
  const configured = process.env.NEWS_RSS_FEEDS;
  if (!configured) return fallbackResult('Public RSS/news feeds', 'NEWS_RSS_FEEDS', 'Add comma-separated public RSS URLs to enable live public news ingestion.');
  const urls = configured.split(',').map((item) => item.trim()).filter(Boolean);
  const items = [];
  for (const url of urls.slice(0, 5)) {
    try {
      const xml = await fetchText(url);
      const blocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
      for (const [index, block] of blocks.slice(0, 10).entries()) {
        items.push({ id: `rss-${items.length}-${index}`, provider: 'Public RSS/news feeds', title: strip(block.match(/<title[\s\S]*?<\/title>/)?.[0] ?? 'Public feed item'), category: 'Live Travel Intelligence', summary: strip(block.match(/<description[\s\S]*?<\/description>/)?.[0] ?? 'Public RSS item received.'), url: strip(block.match(/<link[\s\S]*?<\/link>/)?.[0] ?? url), publishedAt: strip(block.match(/<pubDate[\s\S]*?<\/pubDate>/)?.[0] ?? new Date().toISOString()), sourceStatus: 'live' as const, confidence: 'Medium' as const });
      }
    } catch {
      // Continue across feeds; status message reports partial ingestion.
    }
  }
  return { provider: 'Public RSS/news feeds', status: items.length ? 'live' : 'unavailable', source: configured, fetchedAt: new Date().toISOString(), message: items.length ? 'Public RSS feeds ingested.' : 'Configured RSS feeds were unavailable.', items };
}
