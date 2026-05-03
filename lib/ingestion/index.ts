import { alerts } from '@/lib/data';
import { isNeonConfigured, query } from '@/lib/neon';
import { fetchCanadaTravelAdvice } from '@/lib/providers/canada-travel';
import { fetchFcdoAdvice } from '@/lib/providers/fcdo';
import { fetchPublicRssFeeds } from '@/lib/providers/public-rss';
import { fetchRestCountriesBaseline } from '@/lib/providers/rest-countries';
import { fetchSmartravellerAdvice } from '@/lib/providers/smartraveller';
import { fetchUsStateAdvice } from '@/lib/providers/us-state';
import type { ProviderItem, ProviderResult } from '@/lib/providers/shared';

async function persistItem(item: ProviderItem) {
  if (!isNeonConfigured()) return;
  await query(
    `insert into risk_sources (name, source_type, status, last_checked_at, notes)
     values ($1,$2,$3,now(),$4)
     on conflict (name) do update set status = excluded.status, last_checked_at = now(), notes = excluded.notes`,
    [item.provider, item.sourceStatus, item.sourceStatus === 'live' ? 'active' : 'demo', item.summary]
  ).catch(() => []);
  if (item.category.toLowerCase().includes('advisory')) {
    await query(
      `insert into advisories (country_iso2, title, source, source_url, severity, summary, issued_at, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [item.countryIso2 ?? null, item.title, item.provider, item.url ?? null, item.severity ?? 'Moderate', item.summary, item.publishedAt, item.sourceStatus]
    ).catch(() => []);
  } else {
    await query(
      `insert into risk_events (title, country_iso2, city_name, category, severity, source, summary, recommended_action, event_time, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [item.title, item.countryIso2 ?? null, item.city ?? null, item.category, item.severity ?? 'Moderate', item.provider, item.summary, 'Review source and update itinerary guidance if relevant.', item.publishedAt, item.sourceStatus]
    ).catch(() => []);
  }
}

export async function runIngestion(options: { countryIso2?: string; cityId?: string } = {}) {
  const results: ProviderResult[] = await Promise.all([
    fetchRestCountriesBaseline(),
    fetchFcdoAdvice(options.countryIso2),
    fetchUsStateAdvice(options.countryIso2),
    fetchCanadaTravelAdvice(options.countryIso2),
    fetchSmartravellerAdvice(options.countryIso2),
    fetchPublicRssFeeds()
  ]);
  const items = results.flatMap((result) => result.items);
  await Promise.all(items.map(persistItem));
  return {
    requested: options,
    persisted: isNeonConfigured(),
    fetchedAt: new Date().toISOString(),
    providers: results,
    demoAlertsAvailable: alerts.length,
    sourceIntegrity: 'Provider data is stored when DATABASE_URL is configured. Demo fallback remains clearly labelled.'
  };
}
