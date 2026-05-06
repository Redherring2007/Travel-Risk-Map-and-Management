import { alerts, cities, countries } from './data';
import { isNeonConfigured, query } from './neon';
import type { Alert } from './types';

export type SourceSummaryItem = { source: string; status: string; confidence: string; lastUpdated: string; records?: number };

type EventRow = { title: string; country_iso2: string | null; city_name: string | null; category: string; severity: Alert['severity']; source: string; summary: string; recommended_action: string | null; occurred_at: string; event_time: string | null; confidence: string | null; status: string };
type AdvisoryRow = { title: string; country_iso2: string | null; source: string; level: string | null; severity: Alert['severity'] | null; body: string | null; summary: string | null; url: string | null; published_at: string | null; issued_at: string | null; confidence: string | null; status: string | null };
type FreshnessRow = { source_key: string; source_name: string; status: string; last_success_at: string | null; last_attempt_at: string; last_error: string | null; records_fetched: number; records_stored: number; freshness_minutes: number | null };

export async function loadRelevantEvents(countryIso2?: string, cityName?: string): Promise<Alert[]> {
  if (!isNeonConfigured()) {
    const country = countries.find((item) => item.iso2 === countryIso2);
    return alerts.filter((alert) => !country || alert.country === country.name || alert.city === cityName);
  }
  const rows = await query<EventRow>(
    `select title, country_iso2, city_name, category, severity, source, summary, recommended_action, occurred_at, event_time, confidence, status
     from risk_events where ($1::text is null or country_iso2 = $1) and ($2::text is null or city_name is null or lower(city_name) = lower($2))
     order by coalesce(event_time, occurred_at) desc limit 100`,
    [countryIso2 ?? null, cityName ?? null]
  ).catch(() => []);
  return rows.map((row, index) => ({ id: `db-event-${index}`, title: row.title, country: countries.find((item) => item.iso2 === row.country_iso2)?.name ?? row.country_iso2 ?? 'Global', city: row.city_name ?? undefined, category: row.category, severity: row.severity, source: row.source, timestamp: row.event_time ?? row.occurred_at, summary: row.summary, recommendedAction: row.recommended_action ?? 'Review source and adapt itinerary controls.', approved: row.status === 'approved' }));
}

export async function loadRelevantAdvisories(countryIso2?: string): Promise<Alert[]> {
  if (!isNeonConfigured()) {
    const country = countries.find((item) => item.iso2 === countryIso2);
    return alerts.filter((alert) => !country || alert.country === country.name);
  }
  const rows = await query<AdvisoryRow>(
    `select title, country_iso2, source, level, severity, body, summary, url, published_at, issued_at, confidence, status
     from advisories where ($1::text is null or country_iso2 = $1) order by coalesce(issued_at, published_at, ingested_at) desc limit 50`,
    [countryIso2 ?? null]
  ).catch(() => []);
  return rows.map((row, index) => ({ id: `db-advisory-${index}`, title: row.title, country: countries.find((item) => item.iso2 === row.country_iso2)?.name ?? row.country_iso2 ?? 'Global', category: 'Travel advisory', severity: row.severity ?? 'Moderate', source: row.source, timestamp: row.issued_at ?? row.published_at ?? new Date().toISOString(), summary: row.summary ?? row.body ?? 'Advisory item received.', recommendedAction: row.level ?? 'Review official advisory source.', approved: true }));
}

export async function loadFreshnessSummary(): Promise<SourceSummaryItem[]> {
  if (!isNeonConfigured()) return [{ source: 'Demo fallback', status: 'demo', confidence: 'Low', lastUpdated: new Date().toISOString(), records: alerts.length }];
  const rows = await query<FreshnessRow>('select * from data_source_freshness order by last_attempt_at desc limit 30').catch(() => []);
  return rows.map((row) => ({ source: row.source_name, status: row.status, confidence: row.status === 'live' ? 'High' : row.status === 'unavailable' ? 'Low' : 'Medium', lastUpdated: row.last_success_at ?? row.last_attempt_at, records: row.records_stored }));
}

export function loadCityProfile(countryIso2?: string, cityName?: string) {
  return cities.find((city) => city.countryIso2 === countryIso2 && (!cityName || city.name.toLowerCase() === cityName.toLowerCase())) ?? null;
}
