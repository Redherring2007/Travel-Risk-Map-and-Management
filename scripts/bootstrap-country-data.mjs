#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const ROOT = resolve(process.cwd());
const BOOTSTRAP_COUNTRIES = ['GB', 'US', 'AE', 'KE', 'FR', 'SG'];
const USER_AGENT = process.env.OSM_USER_AGENT || 'AtlasInsightRiskMap/0.1 bootstrap (admin@atlasinsight.local)';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(resolve(ROOT, '.env.local'));
loadEnvFile(resolve(ROOT, '.env'));

const DATABASE_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required. Copy .env.example to .env.local and add your Neon connection string.');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const nowIso = () => new Date().toISOString();
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

async function run(sqlText, params = []) {
  return sql(sqlText, params);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json', 'user-agent': USER_AGENT, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, { headers: { accept: 'application/json,text/plain,text/xml,*/*', 'user-agent': USER_AGENT, ...(options.headers || {}) } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText} for ${url}`);
  return response.text();
}

function levelFromText(value = '') {
  const text = value.toLowerCase();
  if (/(do not travel|avoid|critical|severe|war|missile|evacuat)/.test(text)) return 'Critical';
  if (/(reconsider|high|terror|kidnap|violent|earthquake|cyclone|hurricane|conflict)/.test(text)) return 'High';
  if (/(increased caution|moderate|protest|strike|disrupt|health alert|watch)/.test(text)) return 'Moderate';
  return 'Low';
}

function wbLatest(points = []) {
  return points.find((point) => point?.value !== null && point?.value !== undefined) ?? null;
}

async function freshness(sourceKey, sourceName, status, fetched, stored, error = null, required = false) {
  await run(
    `insert into data_source_freshness (source_key, source_name, status, last_success_at, last_attempt_at, last_error, records_fetched, records_stored, freshness_minutes, required_for_risk)
     values ($1,$2,$3,$4,now(),$5,$6,$7,$8,$9)
     on conflict (source_key) do update set source_name = excluded.source_name, status = excluded.status, last_success_at = excluded.last_success_at, last_attempt_at = now(), last_error = excluded.last_error, records_fetched = excluded.records_fetched, records_stored = excluded.records_stored, freshness_minutes = excluded.freshness_minutes, required_for_risk = excluded.required_for_risk, updated_at = now()`,
    [sourceKey, sourceName, status, status === 'live' ? new Date().toISOString() : null, error, fetched, stored, status === 'live' ? 0 : null, required]
  );
  await run(
    `insert into risk_sources (source_key, source_name, source_type, status, last_success_at, last_error, config)
     values ($1,$2,$3,$4,$5,$6,$7::jsonb)
     on conflict (source_key) do update set source_name = excluded.source_name, source_type = excluded.source_type, status = excluded.status, last_success_at = excluded.last_success_at, last_error = excluded.last_error, config = excluded.config, updated_at = now()`,
    [sourceKey, sourceName, sourceName, status, status === 'live' ? new Date().toISOString() : null, error, JSON.stringify({ bootstrap: true })]
  );
}

async function sourceReference(item) {
  await run(
    `insert into source_references (source_key, source_name, source_type, title, url, country_iso2, city_name, confidence, source_status, published_at, raw_payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     on conflict do nothing`,
    [item.sourceKey, item.sourceName, item.sourceType, item.title, item.url ?? null, item.countryIso2 ?? null, item.cityName ?? null, item.confidence ?? 'Medium', item.sourceStatus ?? 'live', item.publishedAt ?? new Date().toISOString(), JSON.stringify(item.rawPayload ?? {})]
  );
}

async function upsertCountry(country) {
  const currency = country.currencies ? Object.entries(country.currencies).map(([code, data]) => `${code}${data?.name ? ` - ${data.name}` : ''}`).join(', ') : null;
  await run(
    `insert into countries (iso2, iso3, name, capital, region, population, government_type, languages, currency, time_zones, area, country_visual_prompt)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (iso2) do update set iso3 = excluded.iso3, name = excluded.name, capital = excluded.capital, region = excluded.region, population = excluded.population, languages = excluded.languages, currency = excluded.currency, time_zones = excluded.time_zones, area = excluded.area, country_visual_prompt = excluded.country_visual_prompt, updated_at = now()`,
    [country.cca2, country.cca3, country.name.common, country.capital?.[0] ?? null, country.region ?? null, country.population?.toLocaleString('en') ?? null, 'Public baseline; detailed government structure requires Wikidata/official extraction.', Object.values(country.languages ?? {}), currency, country.timezones ?? [], country.area ? `${country.area.toLocaleString('en')} sq km` : null, `Premium Atlas Insight country visual for ${country.name.common}, ${country.region ?? 'global'}, dark intelligence atlas style, no text.`]
  );
  const profileParams = [
    country.cca2,
    'Use official government advisory sources and destination entry rules before travel.',
    'Baseline country profile ingested. Advisory and event data is layered separately where available.',
    'Limited verified data available until crime/security providers are ingested.',
    'Limited verified data available until advisory/event providers are ingested.',
    'Limited verified data available.',
    'Limited verified data available.',
    'Limited verified data available.',
    'See health profile and official provider updates where available.',
    'Limited verified data available.',
    'See health profile and OSM medical POIs where available.',
    'Emergency capability must be verified through official/local sources.',
    'See disaster/weather feeds where available.',
    'See infrastructure profile and OSM transport POIs where available.',
    'See aviation/disruption feeds where configured.',
    'Limited verified data available.',
    ['Limited verified data available'],
    'Use source-backed advisories, event monitoring and itinerary-specific assessment before operational reliance.',
    'Persisted baseline profile from REST Countries plus provider-ingested intelligence where available.'
  ];
  await run(
    `insert into country_profiles (country_iso2, entry_visa_notes, security_overview, crime_overview, terrorism_conflict_overview, kidnap_extortion_risk, political_stability, protest_civil_unrest_risk, health_risks, hygiene_water_food_safety, medical_capability, emergency_services_capability, natural_hazards, transport_infrastructure_risk, airport_travel_disruption_risk, local_laws_culture, areas_to_avoid, recommendation, verified_data_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     on conflict (country_iso2) do update set verified_data_status = excluded.verified_data_status, updated_at = now()`,
    profileParams
  );
  await sourceReference({ sourceKey: 'rest-countries', sourceName: 'REST Countries', sourceType: 'Country baseline', title: `${country.name.common} REST Countries profile`, url: `https://restcountries.com/v3.1/alpha/${country.cca2}`, countryIso2: country.cca2, confidence: 'High', rawPayload: country });
}

async function bootstrapRestCountries() {
  const data = await fetchJson(`https://restcountries.com/v3.1/alpha?codes=${BOOTSTRAP_COUNTRIES.join(',')}&fields=cca2,cca3,name,capital,region,population,area,languages,currencies,timezones`);
  for (const country of data) await upsertCountry(country);
  await freshness('rest-countries', 'REST Countries', 'live', data.length, data.length, null, true);
  return data;
}

async function bootstrapWorldBank(iso2) {
  const indicators = {
    gdpCurrentUsd: 'NY.GDP.MKTP.CD',
    inflationPercent: 'FP.CPI.TOTL.ZG',
    healthExpenditurePercentGdp: 'SH.XPD.CHEX.GD.ZS',
    internetUsersPercent: 'IT.NET.USER.ZS',
    populationTotal: 'SP.POP.TOTL',
    lifeExpectancyYears: 'SP.DYN.LE00.IN',
    airPassengers: 'IS.AIR.PSGR'
  };
  const entries = [];
  for (const [key, indicator] of Object.entries(indicators)) {
    const url = `https://api.worldbank.org/v2/country/${iso2}/indicator/${indicator}?format=json&per_page=8`;
    const payload = await fetchJson(url);
    entries.push([key, { indicator, point: wbLatest(Array.isArray(payload?.[1]) ? payload[1] : []), url }]);
  }
  const raw = Object.fromEntries(entries);
  const value = (key) => raw[key]?.point?.value ?? null;
  const date = (key) => raw[key]?.point?.date ?? null;
  const infrastructure = { airPassengers: value('airPassengers'), airPassengersYear: date('airPassengers') };
  await run(
    `insert into country_master_profiles (country_iso2, source, fetched_at, confidence, gdp_current_usd, inflation_percent, population_total, life_expectancy_years, internet_users_percent, health_expenditure_percent_gdp, infrastructure_indicators, raw_payload)
     values ($1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
     on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, gdp_current_usd = excluded.gdp_current_usd, inflation_percent = excluded.inflation_percent, population_total = excluded.population_total, life_expectancy_years = excluded.life_expectancy_years, internet_users_percent = excluded.internet_users_percent, health_expenditure_percent_gdp = excluded.health_expenditure_percent_gdp, infrastructure_indicators = excluded.infrastructure_indicators, raw_payload = excluded.raw_payload, updated_at = now()`,
    [iso2, 'World Bank public API', 'High', value('gdpCurrentUsd'), value('inflationPercent'), value('populationTotal'), value('lifeExpectancyYears'), value('internetUsersPercent'), value('healthExpenditurePercentGdp'), JSON.stringify(infrastructure), JSON.stringify(raw)]
  );
  await run(
    `insert into country_health_profiles (country_iso2, source, fetched_at, confidence, health_expenditure_percent_gdp, life_expectancy_years, raw_payload)
     values ($1,$2,now(),$3,$4,$5,$6::jsonb)
     on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, health_expenditure_percent_gdp = excluded.health_expenditure_percent_gdp, life_expectancy_years = excluded.life_expectancy_years, raw_payload = excluded.raw_payload, updated_at = now()`,
    [iso2, 'World Bank public API', 'High', value('healthExpenditurePercentGdp'), value('lifeExpectancyYears'), JSON.stringify(raw)]
  );
  await run(
    `insert into country_infrastructure_profiles (country_iso2, source, fetched_at, confidence, internet_users_percent, infrastructure_indicators, raw_payload)
     values ($1,$2,now(),$3,$4,$5::jsonb,$6::jsonb)
     on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, internet_users_percent = excluded.internet_users_percent, infrastructure_indicators = excluded.infrastructure_indicators, raw_payload = excluded.raw_payload, updated_at = now()`,
    [iso2, 'World Bank public API', 'High', value('internetUsersPercent'), JSON.stringify(infrastructure), JSON.stringify(raw)]
  );
  await sourceReference({ sourceKey: 'world-bank', sourceName: 'World Bank', sourceType: 'Country indicators', title: `${iso2} World Bank indicators`, url: `https://api.worldbank.org/v2/country/${iso2}`, countryIso2: iso2, confidence: 'High', rawPayload: raw });
  return 1;
}

async function bootstrapWikidata(iso2) {
  const query = `
    SELECT ?country ?countryLabel ?capitalLabel ?governmentLabel ?timezoneLabel WHERE {
      ?country wdt:P297 "${iso2}".
      OPTIONAL { ?country wdt:P36 ?capital. }
      OPTIONAL { ?country wdt:P122 ?government. }
      OPTIONAL { ?country wdt:P421 ?timezone. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    } LIMIT 20`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  const data = await fetchJson(url, { headers: { accept: 'application/sparql-results+json' } });
  const rows = data?.results?.bindings ?? [];
  const payload = { rows, url };
  const first = rows[0] ?? {};
  await run(
    `insert into country_security_profiles (country_iso2, source, fetched_at, confidence, government_structure, raw_payload)
     values ($1,$2,now(),$3,$4,$5::jsonb)
     on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, government_structure = excluded.government_structure, raw_payload = country_security_profiles.raw_payload || excluded.raw_payload, updated_at = now()`,
    [iso2, 'Wikidata SPARQL', rows.length ? 'Medium' : 'Low', first.governmentLabel?.value ?? null, JSON.stringify(payload)]
  );
  await run(
    `insert into country_master_profiles (country_iso2, source, fetched_at, confidence, government_structure, timezone, raw_payload)
     values ($1,$2,now(),$3,$4,$5,$6::jsonb)
     on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, government_structure = coalesce(excluded.government_structure, country_master_profiles.government_structure), timezone = coalesce(excluded.timezone, country_master_profiles.timezone), raw_payload = country_master_profiles.raw_payload || excluded.raw_payload, updated_at = now()`,
    [iso2, 'Wikidata SPARQL', rows.length ? 'Medium' : 'Low', first.governmentLabel?.value ?? null, first.timezoneLabel?.value ?? null, JSON.stringify(payload)]
  );
  await sourceReference({ sourceKey: 'wikidata', sourceName: 'Wikidata', sourceType: 'Public structured data', title: `${iso2} Wikidata country context`, url, countryIso2: iso2, confidence: rows.length ? 'Medium' : 'Low', rawPayload: payload });
  return rows.length;
}

async function nominatimSearch(countryIso2, type, queryText) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&countrycodes=${countryIso2.toLowerCase()}&q=${encodeURIComponent(queryText)}`;
  const data = await fetchJson(url);
  await sleep(1150);
  for (const poi of data) {
    const name = poi.display_name || `${type} candidate`;
    await run(
      `insert into location_pois (country_iso2, poi_type, name, latitude, longitude, address, source, source_url, confidence, fetched_at, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10::jsonb)`,
      [countryIso2, type, name, Number.isFinite(Number(poi.lat)) ? Number(poi.lat) : null, Number.isFinite(Number(poi.lon)) ? Number(poi.lon) : null, name, 'OpenStreetMap Nominatim', url, 'Medium', JSON.stringify(poi)]
    );
    if (type === 'hotels') {
      await run(
        `insert into hotel_candidates (country_iso2, name, latitude, longitude, address, source, source_url, confidence, fetched_at, raw_payload)
         values ($1,$2,$3,$4,$5,$6,$7,$8,now(),$9::jsonb)`,
        [countryIso2, name, Number.isFinite(Number(poi.lat)) ? Number(poi.lat) : null, Number.isFinite(Number(poi.lon)) ? Number(poi.lon) : null, name, 'OpenStreetMap Nominatim', url, 'Medium', JSON.stringify(poi)]
      );
    }
  }
  return data.length;
}

async function bootstrapOsm(country) {
  const capital = country.capital?.[0] || country.name.common;
  let stored = 0;
  stored += await nominatimSearch(country.cca2, 'hotels', `hotel ${capital}`);
  stored += await nominatimSearch(country.cca2, 'hospitals', `hospitals near ${capital}`);
  stored += await nominatimSearch(country.cca2, 'embassies', `embassy near ${capital}`);
  stored += await nominatimSearch(country.cca2, 'police', `police station near ${capital}`);
  stored += await nominatimSearch(country.cca2, 'airports', `airport near ${capital}`);
  await sourceReference({ sourceKey: 'osm', sourceName: 'OpenStreetMap Nominatim', sourceType: 'Location POI', title: `${country.name.common} OSM POI bootstrap`, url: 'https://nominatim.openstreetmap.org/', countryIso2: country.cca2, confidence: stored ? 'Medium' : 'Low', rawPayload: { capital, stored } });
  return stored;
}

const FCDO_SLUGS = { GB: 'united-kingdom', US: 'usa', AE: 'united-arab-emirates', KE: 'kenya', FR: 'france', SG: 'singapore' };
async function bootstrapFcdo(country) {
  const slug = FCDO_SLUGS[country.cca2];
  if (!slug) return 0;
  const url = `https://www.gov.uk/api/content/foreign-travel-advice/${slug}`;
  const data = await fetchJson(url);
  const title = data.title || `${country.name.common} FCDO travel advice`;
  const description = data.description || 'FCDO travel advice retrieved.';
  const severity = levelFromText(`${title} ${description}`);
  await run(
    `insert into advisories (country_iso2, source, level, title, body, url, published_at, source_url, severity, summary, issued_at, status, confidence, raw_payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
    [country.cca2, 'UK FCDO GOV.UK Content API', severity, title, description, `https://www.gov.uk/foreign-travel-advice/${slug}`, data.public_updated_at ?? new Date().toISOString(), url, severity, description, data.public_updated_at ?? new Date().toISOString(), 'live', 'High', JSON.stringify(data)]
  );
  await sourceReference({ sourceKey: 'fcdo', sourceName: 'UK FCDO', sourceType: 'Travel advisory', title, url, countryIso2: country.cca2, confidence: 'High', rawPayload: data });
  return 1;
}

async function bootstrapUsgs() {
  const url = process.env.USGS_EARTHQUAKE_FEED_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_week.geojson';
  const data = await fetchJson(url);
  let stored = 0;
  for (const feature of data.features ?? []) {
    const props = feature.properties ?? {};
    await run(
      `insert into risk_events (title, category, severity, source, summary, recommended_action, event_time, confidence, status, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [props.title || 'USGS earthquake event', 'Natural hazards', levelFromText(`${props.title} ${props.mag}`), 'USGS Earthquake Hazards Program', props.title || 'Significant earthquake event.', 'Review route and infrastructure exposure if travelling nearby.', props.time ? new Date(props.time).toISOString() : new Date().toISOString(), 'High', 'pending', JSON.stringify(feature)]
    );
    stored += 1;
  }
  await sourceReference({ sourceKey: 'usgs', sourceName: 'USGS', sourceType: 'Natural hazard feed', title: 'USGS significant earthquakes weekly feed', url, confidence: 'High', rawPayload: { count: stored } });
  await freshness('usgs', 'USGS earthquakes', 'live', stored, stored, null, false);
  return stored;
}

async function bootstrapRss() {
  const feeds = (process.env.NEWS_RSS_FEEDS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!feeds.length) {
    await freshness('public-rss', 'Public RSS feeds', 'missing_key', 0, 0, 'NEWS_RSS_FEEDS not configured.', false);
    return 0;
  }
  let stored = 0;
  for (const url of feeds.slice(0, 6)) {
    try {
      const text = await fetchText(url);
      await sourceReference({ sourceKey: 'public-rss', sourceName: 'Public RSS feed', sourceType: 'News/RSS', title: `RSS source ${url}`, url, confidence: 'Medium', rawPayload: { sample: text.slice(0, 2000) } });
      stored += 1;
    } catch (error) {
      console.warn(`RSS fetch failed for ${url}: ${error.message}`);
    }
  }
  await freshness('public-rss', 'Public RSS feeds', stored ? 'live' : 'unavailable', feeds.length, stored, stored ? null : 'No RSS feeds could be fetched.', false);
  return stored;
}

async function bootstrapOfficialConfigured() {
  const urls = (process.env.OFFICIAL_PAGE_URLS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!urls.length) {
    await freshness('official-page-extractor', 'Official page extractor', 'missing_key', 0, 0, 'OFFICIAL_PAGE_URLS not configured.', false);
    return 0;
  }
  let stored = 0;
  for (const url of urls.slice(0, 8)) {
    const text = await fetchText(url);
    const isoMatch = url.match(/\b(GB|US|AE|KE|FR|SG)\b/i);
    const iso = isoMatch?.[1]?.toUpperCase() ?? null;
    await run(
      `insert into official_page_extractions (country_iso2, source_url, title, extracted_text, extraction_method, confidence, fetched_at, raw_payload)
       values ($1,$2,$3,$4,$5,$6,now(),$7::jsonb)
       on conflict (source_url, coalesce(country_iso2, '')) do update set extracted_text = excluded.extracted_text, fetched_at = now(), raw_payload = excluded.raw_payload`,
      [iso, url, `Official page extraction ${url}`, text.slice(0, 12000), 'controlled-public-page-fetch', 'Medium', JSON.stringify({ length: text.length })]
    );
    stored += 1;
  }
  await freshness('official-page-extractor', 'Official page extractor', 'live', urls.length, stored, null, false);
  return stored;
}

async function main() {
  console.log('Atlas Insight bootstrap starting...');
  const summary = [];
  let countries = [];
  try {
    countries = await bootstrapRestCountries();
    summary.push(['rest-countries', countries.length]);
  } catch (error) {
    await freshness('rest-countries', 'REST Countries', 'unavailable', 0, 0, error.message, true);
    throw error;
  }

  let wb = 0, wiki = 0, osm = 0, fcdo = 0;
  for (const country of countries) {
    console.log(`Bootstrapping ${country.cca2} ${country.name.common}`);
    try { wb += await bootstrapWorldBank(country.cca2); } catch (error) { console.warn(`World Bank ${country.cca2}: ${error.message}`); }
    try { wiki += await bootstrapWikidata(country.cca2); } catch (error) { console.warn(`Wikidata ${country.cca2}: ${error.message}`); }
    try { osm += await bootstrapOsm(country); } catch (error) { console.warn(`OSM ${country.cca2}: ${error.message}`); }
    try { fcdo += await bootstrapFcdo(country); } catch (error) { console.warn(`FCDO ${country.cca2}: ${error.message}`); }
  }
  await freshness('world-bank', 'World Bank indicators', wb ? 'live' : 'unavailable', countries.length, wb, wb ? null : 'No World Bank records stored.', false);
  await freshness('wikidata', 'Wikidata SPARQL', wiki ? 'live' : 'unavailable', countries.length, wiki, wiki ? null : 'No Wikidata records stored.', false);
  await freshness('osm', 'OpenStreetMap Nominatim', osm ? 'live' : 'unavailable', countries.length, osm, osm ? null : 'No OSM records stored.', false);
  await freshness('fcdo', 'UK FCDO GOV.UK Content API', fcdo ? 'live' : 'unavailable', countries.length, fcdo, fcdo ? null : 'No FCDO records stored.', true);
  summary.push(['world-bank', wb], ['wikidata', wiki], ['osm', osm], ['fcdo', fcdo]);

  try { summary.push(['usgs', await bootstrapUsgs()]); } catch (error) { await freshness('usgs', 'USGS earthquakes', 'unavailable', 0, 0, error.message, false); }
  try { summary.push(['public-rss', await bootstrapRss()]); } catch (error) { console.warn(`RSS: ${error.message}`); }
  try { summary.push(['official-page-extractor', await bootstrapOfficialConfigured()]); } catch (error) { console.warn(`Official extraction: ${error.message}`); }

  for (const [provider, count] of summary) console.log(`${provider}: ${count} records stored/processed`);
  console.log('Atlas Insight bootstrap complete. Run /api/admin/diagnostics/data-status to inspect persisted data health.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
