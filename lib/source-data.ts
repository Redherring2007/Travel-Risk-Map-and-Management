import { alerts, cities, countries } from './data';
import { riskCategories, score } from './risk-engine';
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


type CountryRow = {
  iso2: string;
  iso3: string;
  name: string;
  capital: string | null;
  region: string | null;
  population: string | null;
  government_type: string | null;
  languages: string[] | null;
  currency: string | null;
  time_zones: string[] | null;
  area: string | null;
  gdp: string | null;
  country_image_url: string | null;
  country_visual_prompt: string | null;
  entry_visa_notes: string | null;
  security_overview: string | null;
  crime_overview: string | null;
  terrorism_conflict_overview: string | null;
  kidnap_extortion_risk: string | null;
  political_stability: string | null;
  protest_civil_unrest_risk: string | null;
  health_risks: string | null;
  hygiene_water_food_safety: string | null;
  medical_capability: string | null;
  emergency_services_capability: string | null;
  natural_hazards: string | null;
  transport_infrastructure_risk: string | null;
  airport_travel_disruption_risk: string | null;
  local_laws_culture: string | null;
  areas_to_avoid: string[] | null;
  recommendation: string | null;
  verified_data_status: string | null;
};

type RiskScoreRow = { country_iso2: string; category: string; value: number; confidence: 'Low' | 'Medium' | 'High'; sources: string[] | null; source_status: 'demo' | 'live' | 'limited' | 'manual_override'; last_updated: string };

type TableCountRow = { table_name: string; count: string };

const limitedText = 'Limited verified data available.';

function riskForCountry(iso2: string, rows: RiskScoreRow[]) {
  const countryRows = rows.filter((row) => row.country_iso2 === iso2);
  if (countryRows.length) {
    const mapped = countryRows.map((row) => score(row.category as Parameters<typeof score>[0], row.value, row.sources ?? ['Neon persisted risk score'], row.confidence, row.source_status));
    return mapped.some((item) => item.category === 'overall') ? mapped : [score('overall', mapped.reduce((total, item) => total + item.value, 0) / Math.max(mapped.length, 1), mapped.flatMap((item) => item.sources), 'Medium', mapped.some((item) => item.sourceStatus === 'live') ? 'live' : 'limited'), ...mapped];
  }
  const demo = countries.find((country) => country.iso2 === iso2)?.risk;
  if (demo) return demo.map((item) => ({ ...item, sourceStatus: item.sourceStatus === 'demo' ? 'limited' as const : item.sourceStatus, sources: Array.from(new Set([...item.sources, 'Neon baseline profile with fallback risk model'])) }));
  return [score('overall', 18, ['Neon baseline profile; fallback risk model'], 'Low', 'limited'), ...riskCategories.map((category) => score(category, 18, ['Neon baseline profile; fallback risk model'], 'Low', 'limited'))];
}

function countryFromRow(row: CountryRow, riskRows: RiskScoreRow[]): import('./types').CountryProfile {
  const fallback = countries.find((country) => country.iso2 === row.iso2);
  return {
    iso2: row.iso2,
    iso3: row.iso3,
    name: row.name,
    capital: row.capital ?? fallback?.capital ?? limitedText,
    region: row.region ?? fallback?.region ?? limitedText,
    population: row.population ?? fallback?.population ?? limitedText,
    area: row.area ?? fallback?.area,
    gdp: row.gdp ?? fallback?.gdp ?? limitedText,
    countryImageUrl: row.country_image_url ?? fallback?.countryImageUrl,
    countryVisualPrompt: row.country_visual_prompt ?? fallback?.countryVisualPrompt,
    governmentType: row.government_type ?? fallback?.governmentType ?? limitedText,
    languages: row.languages?.length ? row.languages : fallback?.languages ?? [limitedText],
    currency: row.currency ?? fallback?.currency ?? limitedText,
    timeZones: row.time_zones?.length ? row.time_zones : fallback?.timeZones ?? [limitedText],
    entryVisaNotes: row.entry_visa_notes ?? fallback?.entryVisaNotes ?? limitedText,
    securityOverview: row.security_overview ?? fallback?.securityOverview ?? limitedText,
    crimeOverview: row.crime_overview ?? fallback?.crimeOverview ?? limitedText,
    terrorismConflictOverview: row.terrorism_conflict_overview ?? fallback?.terrorismConflictOverview ?? limitedText,
    kidnapExtortionRisk: row.kidnap_extortion_risk ?? fallback?.kidnapExtortionRisk ?? limitedText,
    politicalStability: row.political_stability ?? fallback?.politicalStability ?? limitedText,
    protestCivilUnrestRisk: row.protest_civil_unrest_risk ?? fallback?.protestCivilUnrestRisk ?? limitedText,
    healthRisks: row.health_risks ?? fallback?.healthRisks ?? limitedText,
    hygieneWaterFoodSafety: row.hygiene_water_food_safety ?? fallback?.hygieneWaterFoodSafety ?? limitedText,
    medicalCapability: row.medical_capability ?? fallback?.medicalCapability ?? limitedText,
    emergencyServicesCapability: row.emergency_services_capability ?? fallback?.emergencyServicesCapability ?? limitedText,
    naturalHazards: row.natural_hazards ?? fallback?.naturalHazards ?? limitedText,
    transportInfrastructureRisk: row.transport_infrastructure_risk ?? fallback?.transportInfrastructureRisk ?? limitedText,
    airportTravelDisruptionRisk: row.airport_travel_disruption_risk ?? fallback?.airportTravelDisruptionRisk ?? limitedText,
    localLawsCulture: row.local_laws_culture ?? fallback?.localLawsCulture ?? limitedText,
    areasToAvoid: row.areas_to_avoid?.length ? row.areas_to_avoid : fallback?.areasToAvoid ?? [limitedText],
    recommendation: row.recommendation ?? fallback?.recommendation ?? 'Use persisted provider data where available and verify official sources before travel.',
    verifiedDataStatus: row.verified_data_status ?? 'Neon persisted baseline. Some risk fields may use labelled fallback until provider ingestion is complete.',
    risk: riskForCountry(row.iso2, riskRows)
  };
}

export async function loadPersistedCountries() {
  if (!isNeonConfigured()) return [];
  const [countryRows, riskRows] = await Promise.all([
    query<CountryRow>(`select c.*, cp.entry_visa_notes, cp.security_overview, cp.crime_overview, cp.terrorism_conflict_overview, cp.kidnap_extortion_risk, cp.political_stability, cp.protest_civil_unrest_risk, cp.health_risks, cp.hygiene_water_food_safety, cp.medical_capability, cp.emergency_services_capability, cp.natural_hazards, cp.transport_infrastructure_risk, cp.airport_travel_disruption_risk, cp.local_laws_culture, cp.areas_to_avoid, cp.recommendation, cp.verified_data_status from countries c left join country_profiles cp on cp.country_iso2 = c.iso2 order by c.name`).catch(() => []),
    query<RiskScoreRow>('select country_iso2, category, value, confidence, sources, source_status, last_updated from country_risk_scores').catch(() => [])
  ]);
  return countryRows.map((row) => countryFromRow(row, riskRows));
}

export async function loadPersistedCountry(isoOrName: string) {
  const normalized = isoOrName.toLowerCase();
  const persisted = await loadPersistedCountries();
  return persisted.find((item) => item.iso2.toLowerCase() === normalized || item.iso3.toLowerCase() === normalized || item.name.toLowerCase() === normalized) ?? null;
}

export async function sourceTransparency(origin: string, usedFallback: boolean, countryIso2?: string) {
  const [freshness, advisories, events] = await Promise.all([
    loadFreshnessSummary(),
    loadRelevantAdvisories(countryIso2),
    loadRelevantEvents(countryIso2)
  ]);
  const sourceCount = freshness.reduce((total, item) => total + (item.records ?? 0), 0) + advisories.length + events.length;
  const liveSources = freshness.filter((item) => item.status === 'live').length;
  return {
    dataOrigin: origin,
    sourceCount,
    sourceFreshness: freshness,
    usedFallback,
    confidence: liveSources >= 3 ? 'High' : sourceCount > 0 ? 'Medium' : 'Low'
  };
}

export async function loadTableCounts() {
  if (!isNeonConfigured()) return [];
  const tables = ['countries','country_master_profiles','country_health_profiles','country_security_profiles','country_infrastructure_profiles','location_pois','hotel_candidates','risk_events','advisories','source_references','data_source_freshness','trips','trip_risk_assessments','trip_reports'];
  const rows = await query<TableCountRow>(
    `select table_name, (xpath('/row/count/text()', query_to_xml(format('select count(*) from %I', table_name), false, true, '')))[1]::text as count from unnest($1::text[]) as table_name`,
    [tables]
  ).catch(() => []);
  return rows.map((row) => ({ table: row.table_name, count: Number(row.count ?? 0) }));
}
