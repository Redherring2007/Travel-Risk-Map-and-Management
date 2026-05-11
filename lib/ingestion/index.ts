import { alerts } from '@/lib/data';
import { isNeonConfigured, query } from '@/lib/neon';
import { fetchCanadaTravelAdvice } from '@/lib/providers/canada-travel';
import { fetchFcdoAdvice } from '@/lib/providers/fcdo';
import { fetchAviationDisruption, fetchGdacsAlerts, fetchGdeltEvents, fetchHealthAlerts, fetchNzMfatAdvice, fetchUsgsEarthquakes } from '@/lib/providers/operational';
import { fetchOfficialPageExtractions } from '@/lib/providers/official-page-extractor';
import { fetchOsmPois } from '@/lib/providers/osm';
import { fetchPublicRssFeeds } from '@/lib/providers/public-rss';
import { fetchRestCountriesBaseline } from '@/lib/providers/rest-countries';
import { fetchSmartravellerAdvice } from '@/lib/providers/smartraveller';
import { fetchUsStateAdvice } from '@/lib/providers/us-state';
import { fetchWikidataCountryContext } from '@/lib/providers/wikidata';
import { fetchWorldBankCountryIndicators } from '@/lib/providers/world-bank';
import { providerKeyFor, type ProviderItem, type ProviderResult } from '@/lib/providers/shared';

export type IngestionOptions = { providers?: string[]; countryIso2?: string; cityId?: string };
export type IngestionProviderSummary = { provider: string; status: string; recordsFetched: number; recordsStored: number; errors: string[]; fetchedAt: string; freshnessStatus: string };

const providerRunners: Record<string, (countryIso2?: string) => Promise<ProviderResult>> = {
  'rest-countries': () => fetchRestCountriesBaseline(),
  fcdo: fetchFcdoAdvice,
  'us-state': fetchUsStateAdvice,
  canada: fetchCanadaTravelAdvice,
  smartraveller: fetchSmartravellerAdvice,
  'nz-mfat': fetchNzMfatAdvice,
  gdacs: fetchGdacsAlerts,
  usgs: fetchUsgsEarthquakes,
  gdelt: fetchGdeltEvents,
  health: fetchHealthAlerts,
  aviation: fetchAviationDisruption,
  rss: () => fetchPublicRssFeeds(),
  'world-bank': fetchWorldBankCountryIndicators,
  wikidata: fetchWikidataCountryContext,
  osm: fetchOsmPois,
  'official-page-extractor': fetchOfficialPageExtractions
};

function dedupe(items: ProviderItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = [item.providerKey ?? providerKeyFor(item.provider), item.title, item.countryIso2 ?? '', item.city ?? '', item.publishedAt.slice(0, 10)].join('|').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function persistFreshness(result: ProviderResult, recordsStored: number, errors: string[]) {
  if (!isNeonConfigured()) return;
  const key = result.providerKey ?? providerKeyFor(result.provider);
  await query(
    `insert into data_source_freshness (source_key, source_name, status, last_success_at, last_attempt_at, last_error, records_fetched, records_stored, freshness_minutes, required_for_risk)
     values ($1,$2,$3,$4,now(),$5,$6,$7,$8,$9)
     on conflict (source_key) do update set source_name = excluded.source_name, status = excluded.status, last_success_at = excluded.last_success_at, last_attempt_at = now(), last_error = excluded.last_error, records_fetched = excluded.records_fetched, records_stored = excluded.records_stored, freshness_minutes = excluded.freshness_minutes, required_for_risk = excluded.required_for_risk, updated_at = now()`,
    [key, result.provider, result.status, result.status === 'live' ? result.fetchedAt : null, errors.join('; ') || null, result.items.length, recordsStored, result.status === 'live' ? 0 : null, Boolean(result.requiredForRisk)]
  ).catch(() => []);
  await query(
    `insert into risk_sources (source_key, source_name, source_type, status, last_success_at, last_error, config)
     values ($1,$2,$3,$4,$5,$6,$7)
     on conflict (source_key) do update set source_name = excluded.source_name, source_type = excluded.source_type, status = excluded.status, last_success_at = excluded.last_success_at, last_error = excluded.last_error, updated_at = now()`,
    [key, result.provider, result.source, result.status, result.status === 'live' ? result.fetchedAt : null, errors.join('; ') || null, { url: result.url ?? result.source }]
  ).catch(() => []);
}


function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nestedRecord(value: unknown, key: string): Record<string, unknown> {
  return objectRecord(objectRecord(value)[key]);
}

function pointValue(raw: unknown, key: string): number | null {
  const point = objectRecord(nestedRecord(raw, key).point);
  const value = point.value;
  return typeof value === 'number' ? value : null;
}

function pointDate(raw: unknown, key: string): string | null {
  const point = objectRecord(nestedRecord(raw, key).point);
  const value = point.date;
  return typeof value === 'string' ? value : null;
}

async function persistExpandedCountryData(item: ProviderItem) {
  if (!isNeonConfigured()) return;
  const countryIso2 = item.countryIso2;
  if (!countryIso2) return;
  const raw = objectRecord(item.rawPayload);

  if (item.providerKey === 'world-bank') {
    const infrastructure = {
      airPassengers: pointValue(raw, 'airPassengers'),
      airPassengersYear: pointDate(raw, 'airPassengers')
    };
    await query(
      `insert into country_master_profiles (country_iso2, source, fetched_at, confidence, gdp_current_usd, inflation_percent, population_total, life_expectancy_years, internet_users_percent, health_expenditure_percent_gdp, infrastructure_indicators, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, gdp_current_usd = excluded.gdp_current_usd, inflation_percent = excluded.inflation_percent, population_total = excluded.population_total, life_expectancy_years = excluded.life_expectancy_years, internet_users_percent = excluded.internet_users_percent, health_expenditure_percent_gdp = excluded.health_expenditure_percent_gdp, infrastructure_indicators = excluded.infrastructure_indicators, raw_payload = excluded.raw_payload, updated_at = now()`,
      [countryIso2, item.provider, item.publishedAt, item.confidence, pointValue(raw, 'gdpCurrentUsd'), pointValue(raw, 'inflationPercent'), pointValue(raw, 'populationTotal'), pointValue(raw, 'lifeExpectancyYears'), pointValue(raw, 'internetUsersPercent'), pointValue(raw, 'healthExpenditurePercentGdp'), JSON.stringify(infrastructure), JSON.stringify(raw)]
    ).catch(() => []);
    await query(
      `insert into country_health_profiles (country_iso2, source, fetched_at, confidence, health_expenditure_percent_gdp, life_expectancy_years, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, health_expenditure_percent_gdp = excluded.health_expenditure_percent_gdp, life_expectancy_years = excluded.life_expectancy_years, raw_payload = excluded.raw_payload, updated_at = now()`,
      [countryIso2, item.provider, item.publishedAt, item.confidence, pointValue(raw, 'healthExpenditurePercentGdp'), pointValue(raw, 'lifeExpectancyYears'), JSON.stringify(raw)]
    ).catch(() => []);
    await query(
      `insert into country_infrastructure_profiles (country_iso2, source, fetched_at, confidence, internet_users_percent, infrastructure_indicators, raw_payload)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, internet_users_percent = excluded.internet_users_percent, infrastructure_indicators = excluded.infrastructure_indicators, raw_payload = excluded.raw_payload, updated_at = now()`,
      [countryIso2, item.provider, item.publishedAt, item.confidence, pointValue(raw, 'internetUsersPercent'), JSON.stringify(infrastructure), JSON.stringify(raw)]
    ).catch(() => []);
  }

  if (item.providerKey === 'wikidata') {
    await query(
      `insert into country_master_profiles (country_iso2, source, fetched_at, confidence, raw_payload)
       values ($1,$2,$3,$4,$5::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, raw_payload = country_master_profiles.raw_payload || excluded.raw_payload, updated_at = now()`,
      [countryIso2, item.provider, item.publishedAt, item.confidence, JSON.stringify(raw)]
    ).catch(() => []);
    await query(
      `insert into country_security_profiles (country_iso2, source, fetched_at, confidence, raw_payload)
       values ($1,$2,$3,$4,$5::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, raw_payload = excluded.raw_payload, updated_at = now()`,
      [countryIso2, item.provider, item.publishedAt, item.confidence, JSON.stringify(raw)]
    ).catch(() => []);
  }

  if (item.providerKey === 'osm') {
    for (const [poiType, container] of Object.entries(raw)) {
      const data = objectRecord(container).data;
      const rows = Array.isArray(data) ? data.slice(0, 20) : [];
      for (const row of rows) {
        const poi = objectRecord(row);
        const name = String(poi.display_name ?? poi.name ?? `${poiType} candidate`);
        const lat = Number(poi.lat);
        const lon = Number(poi.lon);
        await query(
          `insert into location_pois (country_iso2, poi_type, name, latitude, longitude, address, source, source_url, confidence, fetched_at, raw_payload)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
          [countryIso2, poiType, name, Number.isFinite(lat) ? lat : null, Number.isFinite(lon) ? lon : null, name, item.provider, item.url ?? null, item.confidence, item.publishedAt, JSON.stringify(poi)]
        ).catch(() => []);
        if (poiType === 'hotels') {
          await query(
            `insert into hotel_candidates (country_iso2, name, latitude, longitude, address, source, source_url, confidence, fetched_at, raw_payload)
             values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
            [countryIso2, name, Number.isFinite(lat) ? lat : null, Number.isFinite(lon) ? lon : null, name, item.provider, item.url ?? null, item.confidence, item.publishedAt, JSON.stringify(poi)]
          ).catch(() => []);
        }
      }
    }
  }

  if (item.providerKey === 'official-page-extractor') {
    await query(
      `insert into official_page_extractions (country_iso2, source_url, title, extracted_text, extraction_method, confidence, fetched_at, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
       on conflict (source_url, coalesce(country_iso2, '')) do update set title = excluded.title, extracted_text = excluded.extracted_text, confidence = excluded.confidence, fetched_at = excluded.fetched_at, raw_payload = excluded.raw_payload`,
      [countryIso2, item.url ?? item.id, item.title, String(objectRecord(raw).extractedText ?? item.summary), String(objectRecord(raw).extractionMethod ?? 'controlled-public-page-fetch'), item.confidence, item.publishedAt, JSON.stringify(raw)]
    ).catch(() => []);
  }
}

async function persistItem(item: ProviderItem) {
  if (!isNeonConfigured()) return false;
  const providerKey = item.providerKey ?? providerKeyFor(item.provider);
  await query(
    `insert into source_references (source_key, source_name, source_type, title, url, country_iso2, city_name, confidence, source_status, published_at, raw_payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     on conflict do nothing`,
    [providerKey, item.provider, item.category, item.title, item.url ?? null, item.countryIso2 ?? null, item.city ?? null, item.confidence, item.sourceStatus, item.publishedAt, item.rawPayload ?? {}]
  ).catch(() => []);

  if (item.category.toLowerCase().includes('advisory')) {
    await query(
      `insert into advisories (country_iso2, source, level, title, body, url, published_at, source_url, severity, summary, issued_at, status, confidence, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [item.countryIso2 ?? null, item.provider, item.severity ?? 'Moderate', item.title, item.summary, item.url ?? null, item.publishedAt, item.url ?? null, item.severity ?? 'Moderate', item.summary, item.publishedAt, item.sourceStatus, item.confidence, item.rawPayload ?? {}]
    ).catch(() => []);
  } else {
    await query(
      `insert into risk_events (title, country_iso2, city_name, category, severity, source, summary, recommended_action, event_time, confidence, status, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [item.title, item.countryIso2 ?? null, item.city ?? null, item.category, item.severity ?? 'Moderate', item.provider, item.summary, item.recommendedAction ?? 'Review source and adapt itinerary controls.', item.publishedAt, item.confidence, item.sourceStatus === 'live' ? 'pending' : 'approved', item.rawPayload ?? {}]
    ).catch(() => []);
  }
  await persistExpandedCountryData(item);
  return true;
}

export async function runIngestion(options: IngestionOptions = {}) {
  const selected = options.providers?.length ? options.providers : ['rest-countries', 'world-bank', 'wikidata', 'osm', 'official-page-extractor', 'fcdo', 'us-state', 'canada', 'smartraveller', 'nz-mfat', 'gdacs', 'usgs', 'gdelt', 'health', 'aviation', 'rss'];
  const summaries: IngestionProviderSummary[] = [];

  for (const providerKey of selected) {
    const runner = providerRunners[providerKey];
    if (!runner) {
      summaries.push({ provider: providerKey, status: 'unavailable', recordsFetched: 0, recordsStored: 0, errors: [`Unknown provider ${providerKey}`], fetchedAt: new Date().toISOString(), freshnessStatus: 'unsupported' });
      continue;
    }
    let result: ProviderResult;
    try {
      result = await runner(options.countryIso2);
    } catch (error) {
      result = { provider: providerKey, providerKey, status: 'unavailable', source: providerKey, fetchedAt: new Date().toISOString(), items: [], message: 'Provider failed.', errors: [error instanceof Error ? error.message : 'unknown error'] };
    }
    const items = dedupe(result.items).map((item) => ({ ...item, providerKey: item.providerKey ?? result.providerKey ?? providerKeyFor(result.provider) }));
    let stored = 0;
    for (const item of items) if (await persistItem(item)) stored += 1;
    const errors = result.errors ?? [];
    await persistFreshness({ ...result, items }, stored, errors);
    summaries.push({ provider: result.provider, status: result.status, recordsFetched: items.length, recordsStored: stored, errors, fetchedAt: result.fetchedAt, freshnessStatus: result.status === 'live' ? 'fresh' : result.status === 'demo_fallback' ? 'demo-fallback' : 'stale-or-unavailable' });
  }

  return {
    requested: options,
    persisted: isNeonConfigured(),
    fetchedAt: new Date().toISOString(),
    providers: summaries,
    demoAlertsAvailable: alerts.length,
    sourceIntegrity: 'Provider data is normalised, deduplicated and stored when DATABASE_URL is configured. Demo fallback remains clearly labelled.'
  };
}
