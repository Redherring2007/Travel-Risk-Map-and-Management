import { findCountry } from './data';
import { isNeonConfigured, query } from './neon';
import { loadFreshnessSummary, loadRelevantAdvisories, loadRelevantEvents } from './source-data';
import type { Alert, CountryProfile } from './types';

export type LocationPoi = {
  id?: string;
  countryIso2?: string;
  cityName?: string;
  poiType: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  source: string;
  sourceUrl?: string | null;
  confidence: 'Low' | 'Medium' | 'High';
  fetchedAt: string;
  rawPayload?: unknown;
};

export type HotelCandidate = {
  id: string;
  countryIso2?: string;
  cityName?: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  source: string;
  sourceUrl?: string | null;
  confidence: 'Low' | 'Medium' | 'High';
  fetchedAt: string;
  rawPayload?: unknown;
};

export type MergedCountryProfile = {
  country: CountryProfile | null;
  baseline: CountryProfile | null;
  advisoryPosition: Alert[];
  economy: Record<string, unknown> | null;
  infrastructure: Record<string, unknown> | null;
  health: Record<string, unknown> | null;
  security: Record<string, unknown> | null;
  transport: Record<string, unknown> | null;
  pois: LocationPoi[];
  hotels: HotelCandidate[];
  events: Alert[];
  officialExtracts: Array<{ sourceUrl: string; title?: string | null; extractedText: string; confidence: string; fetchedAt: string }>;
  sources: Array<{ source: string; status: string; confidence: string; lastUpdated?: string; records?: number }>;
  confidence: 'Low' | 'Medium' | 'High';
  freshness: Awaited<ReturnType<typeof loadFreshnessSummary>>;
  intelligenceGaps: string[];
};

type JsonRow = Record<string, unknown>;

type PoiRow = { id: string; country_iso2: string | null; city_name: string | null; poi_type: string; name: string; latitude: string | number | null; longitude: string | number | null; address: string | null; source: string; source_url: string | null; confidence: 'Low' | 'Medium' | 'High'; fetched_at: string; raw_payload: unknown };
type HotelRow = { id: string; country_iso2: string | null; city_name: string | null; name: string; latitude: string | number | null; longitude: string | number | null; address: string | null; source: string; source_url: string | null; confidence: 'Low' | 'Medium' | 'High'; fetched_at: string; raw_payload: unknown };
type ExtractRow = { source_url: string; title: string | null; extracted_text: string; confidence: string; fetched_at: string };

function numberOrNull(value: string | number | null) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function mergeCountryProfile(countryIso2?: string, cityName?: string): Promise<MergedCountryProfile> {
  const country = countryIso2 ? findCountry(countryIso2) ?? null : null;
  const [advisoryPosition, events, freshness] = await Promise.all([
    loadRelevantAdvisories(countryIso2),
    loadRelevantEvents(countryIso2, cityName),
    loadFreshnessSummary()
  ]);

  const gaps: string[] = [];
  let economy: JsonRow | null = null;
  let infrastructure: JsonRow | null = null;
  let health: JsonRow | null = null;
  let security: JsonRow | null = null;
  let pois: LocationPoi[] = [];
  let hotels: HotelCandidate[] = [];
  let officialExtracts: MergedCountryProfile['officialExtracts'] = [];

  if (isNeonConfigured() && countryIso2) {
    const [masterRows, infraRows, healthRows, securityRows, poiRows, hotelRows, extractRows] = await Promise.all([
      query<JsonRow>('select * from country_master_profiles where country_iso2 = $1 limit 1', [countryIso2]).catch(() => []),
      query<JsonRow>('select * from country_infrastructure_profiles where country_iso2 = $1 limit 1', [countryIso2]).catch(() => []),
      query<JsonRow>('select * from country_health_profiles where country_iso2 = $1 limit 1', [countryIso2]).catch(() => []),
      query<JsonRow>('select * from country_security_profiles where country_iso2 = $1 limit 1', [countryIso2]).catch(() => []),
      query<PoiRow>('select * from location_pois where country_iso2 = $1 and ($2::text is null or city_name is null or lower(city_name) = lower($2)) order by fetched_at desc limit 120', [countryIso2, cityName ?? null]).catch(() => []),
      query<HotelRow>('select * from hotel_candidates where country_iso2 = $1 and ($2::text is null or city_name is null or lower(city_name) = lower($2)) order by fetched_at desc limit 40', [countryIso2, cityName ?? null]).catch(() => []),
      query<ExtractRow>('select source_url, title, extracted_text, confidence, fetched_at from official_page_extractions where country_iso2 = $1 order by fetched_at desc limit 20', [countryIso2]).catch(() => [])
    ]);
    economy = masterRows[0] ?? null;
    infrastructure = infraRows[0] ?? masterRows[0] ?? null;
    health = healthRows[0] ?? null;
    security = securityRows[0] ?? null;
    pois = poiRows.map((row) => ({ id: row.id, countryIso2: row.country_iso2 ?? undefined, cityName: row.city_name ?? undefined, poiType: row.poi_type, name: row.name, latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude), address: row.address, source: row.source, sourceUrl: row.source_url, confidence: row.confidence, fetchedAt: row.fetched_at, rawPayload: row.raw_payload }));
    hotels = hotelRows.map((row) => ({ id: row.id, countryIso2: row.country_iso2 ?? undefined, cityName: row.city_name ?? undefined, name: row.name, latitude: numberOrNull(row.latitude), longitude: numberOrNull(row.longitude), address: row.address, source: row.source, sourceUrl: row.source_url, confidence: row.confidence, fetchedAt: row.fetched_at, rawPayload: row.raw_payload }));
    officialExtracts = extractRows.map((row) => ({ sourceUrl: row.source_url, title: row.title, extractedText: row.extracted_text, confidence: row.confidence, fetchedAt: row.fetched_at }));
  }

  if (!country) gaps.push('Country baseline profile unavailable.');
  if (!economy) gaps.push('World Bank/economic indicators unavailable.');
  if (!health) gaps.push('Health and medical profile unavailable.');
  if (!security) gaps.push('Security/embassy/emergency public profile unavailable.');
  if (!pois.length) gaps.push('OSM POI context unavailable or not yet ingested.');
  if (!hotels.length) gaps.push('OSM hotel candidates unavailable or not yet ingested.');
  if (!officialExtracts.length) gaps.push('Official page extraction text unavailable.');

  const sourceCount = freshness.reduce((total, item) => total + (item.records ?? 0), 0);
  const confidence: MergedCountryProfile['confidence'] = sourceCount > 20 && gaps.length <= 2 ? 'High' : sourceCount > 0 && gaps.length <= 5 ? 'Medium' : 'Low';
  return { country, baseline: country, advisoryPosition, economy, infrastructure, health, security, transport: infrastructure, pois, hotels, events, officialExtracts, sources: freshness, confidence, freshness, intelligenceGaps: gaps };
}
