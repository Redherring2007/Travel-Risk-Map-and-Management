#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const ROOT = resolve(process.cwd());
const USER_AGENT = process.env.OSM_USER_AGENT || 'AtlasInsightRiskMap/0.1 global-bootstrap (admin@atlasinsight.local)';
const THROTTLE_MS = Number(process.env.BOOTSTRAP_THROTTLE_MS || 650);
const OSM_THROTTLE_MS = Number(process.env.OSM_THROTTLE_MS || 1150);


const PROVIDER_TIMEOUT_MS = Number(process.env.PROVIDER_TIMEOUT_MS || 20000);

async function fetchWithTimeout(url, options = {}, timeoutMs = PROVIDER_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
const OSM_MODE = (process.env.BOOTSTRAP_OSM_MODE || 'capitals').toLowerCase(); // off | capitals
const OSM_COUNTRY_LIMIT = Number(process.env.BOOTSTRAP_OSM_COUNTRY_LIMIT || 0); // 0 = all
const REST_COUNTRIES_URL = 'https://restcountries.com/v3.1/all?fields=cca2,cca3,name,capital,region,population,area,languages,currencies,latlng';

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
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const stats = {
  countries: 0,
  capitals: 0,
  providers: 0,
  failures: 0,
  skippedDuplicates: 0,
  stored: {
    sourceReferences: 0,
    advisories: 0,
    events: 0,
    pois: 0,
    hotels: 0,
    worldBankProfiles: 0,
    wikidataProfiles: 0
  }
};

async function run(sqlText, params = []) {
  return sql(sqlText, params);
}

async function withRetry(label, fn, options = {}) {
  const attempts = options.attempts ?? 3;
  const retryStatuses = options.retryStatuses ?? [408, 425, 429, 500, 502, 503, 504];
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const status = Number(error?.status ?? 0);
      const retryable = retryStatuses.includes(status) || /fetch failed or timed out|timeout|network|socket|502|503|504|429/i.test(String(error?.message ?? error));
      if (!retryable || attempt === attempts) break;
      const delay = Math.min(12_000, (options.baseDelayMs ?? 1000) * attempt * attempt);
      console.warn(`${label}: retry ${attempt}/${attempts} after ${error.message}; waiting ${delay}ms`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function fetchJson(url, options = {}) {
  return withRetry(options.label ?? url, async () => {
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: options.accept ?? 'application/json',
        'user-agent': USER_AGENT,
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const error = new Error(`${response.status} ${response.statusText} for ${url}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }, options);
}

async function fetchText(url, options = {}) {
  return withRetry(options.label ?? url, async () => {
    const response = await fetchWithTimeout(url, {
      headers: {
        accept: options.accept ?? 'application/json,text/plain,text/xml,application/xml,*/*',
        'user-agent': USER_AGENT,
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      const error = new Error(`${response.status} ${response.statusText} for ${url}`);
      error.status = response.status;
      throw error;
    }
    return response.text();
  }, options);
}

function clean(value) {
  return String(value ?? '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function normalize(value) {
  return clean(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function severityFromText(value = '') {
  const text = value.toLowerCase();
  if (/(do not travel|avoid|critical|severe|war|missile|evacuat)/.test(text)) return 'Critical';
  if (/(reconsider|high|terror|kidnap|violent|earthquake|cyclone|hurricane|conflict|attack)/.test(text)) return 'High';
  if (/(increased caution|moderate|protest|strike|disrupt|health alert|watch|flood|storm)/.test(text)) return 'Moderate';
  return 'Low';
}

function confidenceFromRelevance(score) {
  if (score >= 75) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

function freshnessWeight(dateValue) {
  const time = new Date(dateValue).getTime();
  if (!Number.isFinite(time)) return 0.25;
  const ageHours = (Date.now() - time) / 36e5;
  if (ageHours <= 72) return 1;
  if (ageHours <= 24 * 7) return 0.75;
  if (ageHours <= 24 * 30) return 0.45;
  return 0.18;
}

function sourceTrust(source = '') {
  if (/(fcdo|state|canada|smartraveller|mfat|gdacs|usgs|cdc|who|government|official)/i.test(source)) return 0.9;
  if (/(rest countries|world bank|wikidata|openstreetmap)/i.test(source)) return 0.78;
  if (/(gdelt|rss|news)/i.test(source)) return 0.45;
  return 0.6;
}

function operationalImpact(title, summary, severity) {
  let impact = { Critical: 1, High: 0.8, Moderate: 0.55, Low: 0.28 }[severity] ?? 0.35;
  const text = normalize(`${title} ${summary}`);
  if (/(airport|aviation|border|strike|road|transport|curfew|attack|terror|kidnap|evacuat|protest|unrest|flood|earthquake|outbreak|disease|cyclone|hurricane)/.test(text)) impact += 0.18;
  if (/(opinion|analysis|market|sports|finance)/.test(text)) impact -= 0.22;
  return Math.max(0.1, Math.min(1, impact));
}

function buildCountryMatcher(countries) {
  const aliases = [];
  for (const country of countries) {
    const names = new Set([country.name?.common, country.name?.official, country.cca2, country.cca3]);
    if (country.name?.common === 'United States') names.add('usa').add('united states of america').add('u s');
    if (country.name?.common === 'United Kingdom') names.add('uk').add('great britain').add('britain');
    for (const name of names) {
      const key = normalize(name);
      if (key.length >= 2) aliases.push({ key, country });
    }
  }
  aliases.sort((a, b) => b.key.length - a.key.length);
  return (title, summary = '') => {
    const text = ` ${normalize(`${title} ${summary}`)} `;
    for (const alias of aliases) {
      if (text.includes(` ${alias.key} `)) return alias.country;
    }
    return null;
  };
}

function parseRss(xml, limit = 80) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) ?? xml.match(/<entry[\s\S]*?<\/entry>/g) ?? [];
  return blocks.slice(0, limit).map((block, index) => {
    const title = clean(block.match(/<title[\s\S]*?<\/title>/)?.[0] ?? `RSS item ${index + 1}`);
    const summary = clean(block.match(/<description[\s\S]*?<\/description>/)?.[0] ?? block.match(/<summary[\s\S]*?<\/summary>/)?.[0] ?? '');
    const link = clean(block.match(/<link[^>]*href=["']([^"']+)/)?.[1] ?? block.match(/<link[\s\S]*?<\/link>/)?.[0] ?? '');
    const publishedAt = clean(block.match(/<pubDate[\s\S]*?<\/pubDate>/)?.[0] ?? block.match(/<updated[\s\S]*?<\/updated>/)?.[0] ?? new Date().toISOString());
    return { title, summary, link, publishedAt };
  });
}

async function ensureSchema() {
  await run(`create extension if not exists pgcrypto`);
  await run(`alter table risk_events add column if not exists relevance_score integer`);
  await run(`alter table risk_events add column if not exists source_trust numeric`);
  await run(`alter table risk_events add column if not exists geo_confidence numeric`);
  await run(`alter table risk_events add column if not exists freshness_weight numeric`);
  await run(`alter table risk_events add column if not exists operational_impact numeric`);
  await run(`create table if not exists country_master_profiles (country_iso2 char(2) primary key references countries(iso2) on delete cascade, source text not null, fetched_at timestamptz not null default now(), confidence text not null default 'Medium', gdp_current_usd numeric, inflation_percent numeric, population_total numeric, life_expectancy_years numeric, internet_users_percent numeric, health_expenditure_percent_gdp numeric, government_structure text, timezone text, infrastructure_indicators jsonb not null default '{}'::jsonb, raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await run(`create table if not exists country_health_profiles (country_iso2 char(2) primary key references countries(iso2) on delete cascade, source text not null, fetched_at timestamptz not null default now(), confidence text not null default 'Medium', health_expenditure_percent_gdp numeric, life_expectancy_years numeric, raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await run(`create table if not exists country_security_profiles (country_iso2 char(2) primary key references countries(iso2) on delete cascade, source text not null, fetched_at timestamptz not null default now(), confidence text not null default 'Medium', government_structure text, raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await run(`create table if not exists country_infrastructure_profiles (country_iso2 char(2) primary key references countries(iso2) on delete cascade, source text not null, fetched_at timestamptz not null default now(), confidence text not null default 'Medium', internet_users_percent numeric, infrastructure_indicators jsonb not null default '{}'::jsonb, raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await run(`create table if not exists location_pois (id uuid primary key default gen_random_uuid(), country_iso2 char(2) references countries(iso2) on delete cascade, city_name text, poi_type text not null, name text not null, latitude numeric(10,6), longitude numeric(10,6), address text, source text not null, source_url text, confidence text not null default 'Medium', fetched_at timestamptz not null default now(), raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await run(`create table if not exists hotel_candidates (id uuid primary key default gen_random_uuid(), country_iso2 char(2) references countries(iso2) on delete cascade, city_name text, name text not null, latitude numeric(10,6), longitude numeric(10,6), address text, source text not null, source_url text, confidence text not null default 'Medium', fetched_at timestamptz not null default now(), raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await run(`create table if not exists official_page_extractions (id uuid primary key default gen_random_uuid(), country_iso2 char(2) references countries(iso2) on delete set null, source_url text not null, title text, extracted_text text, extraction_method text not null default 'controlled-public-page-fetch', confidence text not null default 'Medium', fetched_at timestamptz not null default now(), raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`);
  await run(`create unique index if not exists idx_location_pois_dedupe on location_pois (country_iso2, poi_type, lower(name), coalesce(latitude, 0), coalesce(longitude, 0))`);
  await run(`create unique index if not exists idx_hotel_candidates_dedupe on hotel_candidates (country_iso2, lower(name), coalesce(latitude, 0), coalesce(longitude, 0))`);
  await run(`create unique index if not exists idx_official_page_extractions_dedupe on official_page_extractions (source_url, coalesce(country_iso2, ''))`);
}

async function freshness(sourceKey, sourceName, status, fetched, stored, error = null, required = false, confidence = 'Medium') {
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
    [sourceKey, sourceName, sourceName, status, status === 'live' ? new Date().toISOString() : null, error, JSON.stringify({ bootstrap: true, confidence })]
  );
}

async function sourceReference(item) {
  const rows = await run(
    `insert into source_references (source_key, source_name, source_type, title, url, country_iso2, city_name, confidence, source_status, published_at, raw_payload)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)
     on conflict do nothing returning id`,
    [item.sourceKey, item.sourceName, item.sourceType, item.title, item.url ?? null, item.countryIso2 ?? null, item.cityName ?? null, item.confidence ?? 'Medium', item.sourceStatus ?? 'live', item.publishedAt ?? new Date().toISOString(), JSON.stringify(item.rawPayload ?? {})]
  );
  if (rows.length) stats.stored.sourceReferences += 1;
  else stats.skippedDuplicates += 1;
  return rows.length;
}

async function upsertCountry(country) {
  const currency = country.currencies ? Object.entries(country.currencies).map(([code, data]) => `${code}${data?.name ? ` - ${data.name}` : ''}`).join(', ') : null;
  await run(
    `insert into countries (iso2, iso3, name, capital, region, population, government_type, languages, currency, time_zones, area, country_visual_prompt)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     on conflict (iso2) do update set iso3 = excluded.iso3, name = excluded.name, capital = excluded.capital, region = excluded.region, population = excluded.population, languages = excluded.languages, currency = excluded.currency, time_zones = excluded.time_zones, area = excluded.area, country_visual_prompt = excluded.country_visual_prompt, updated_at = now()`,
    [country.cca2, country.cca3, country.name.common, country.capital?.[0] ?? null, country.region ?? null, country.population?.toLocaleString('en') ?? null, 'Public baseline; detailed government structure requires Wikidata/official extraction.', Object.values(country.languages ?? {}), currency, country.timezones ?? [], country.area ? `${country.area.toLocaleString('en')} sq km` : null, `Premium Atlas Insight country visual for ${country.name.common}, ${country.region ?? 'global'}, dark intelligence atlas style, no text.`]
  );
  await run(
    `insert into country_profiles (country_iso2, entry_visa_notes, security_overview, crime_overview, terrorism_conflict_overview, kidnap_extortion_risk, political_stability, protest_civil_unrest_risk, health_risks, hygiene_water_food_safety, medical_capability, emergency_services_capability, natural_hazards, transport_infrastructure_risk, airport_travel_disruption_risk, local_laws_culture, areas_to_avoid, recommendation, verified_data_status)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
     on conflict (country_iso2) do update set verified_data_status = excluded.verified_data_status, updated_at = now()`,
    [
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
      'Persisted global baseline profile from REST Countries plus provider-ingested intelligence where available.'
    ]
  );
  await sourceReference({ sourceKey: 'rest-countries', sourceName: 'REST Countries', sourceType: 'Country baseline', title: `${country.name.common} REST Countries profile`, url: `https://restcountries.com/v3.1/alpha/${country.cca2}`, countryIso2: country.cca2, confidence: 'High', rawPayload: country });
}

async function upsertCapitalCities(country) {
  let stored = 0;
  for (const capital of country.capital ?? []) {
    const rows = await run(
      `insert into cities (country_iso2, name, latitude, longitude, geocode_source)
       values ($1,$2,$3,$4,$5)
       on conflict (country_iso2, name) do update set geocode_source = excluded.geocode_source
       returning id`,
      [country.cca2, capital, Array.isArray(country.latlng) ? country.latlng[0] ?? null : null, Array.isArray(country.latlng) ? country.latlng[1] ?? null : null, 'REST Countries capital baseline']
    );
    if (rows.length) stored += 1;
    await run(
      `insert into city_profiles (city_id, overview, limited_data)
       select id, $3, true from cities where country_iso2 = $1 and name = $2
       on conflict (city_id) do update set overview = excluded.overview, limited_data = true, updated_at = now()`,
      [country.cca2, capital, `${capital} is the listed capital city for ${country.name.common}. Limited verified city intelligence is available until city-specific providers are connected.`]
    );
  }
  stats.capitals += stored;
}

async function bootstrapRestCountries() {
  const configured = process.env.BOOTSTRAP_COUNTRY_CODES?.split(',').map((item) => item.trim().toUpperCase()).filter(Boolean);
  const data = await fetchJson(REST_COUNTRIES_URL, { label: 'REST Countries global baseline', attempts: 4 });
  const countries = (Array.isArray(data) ? data : [])
    .filter((country) => country.cca2 && country.cca3 && country.name?.common)
    .filter((country) => !configured?.length || configured.includes(country.cca2))
    .sort((a, b) => a.name.common.localeCompare(b.name.common));
  for (const country of countries) {
    await upsertCountry(country);
    await upsertCapitalCities(country);
  }
  await freshness('rest-countries', 'REST Countries', 'live', countries.length, countries.length, null, true, 'High');
  stats.countries = countries.length;
  return countries;
}

async function fetchWorldBankIndicator(indicator) {
  const url = `https://api.worldbank.org/v2/country/all/indicator/${indicator}?format=json&per_page=20000`;
  const payload = await fetchJson(url, { label: `World Bank ${indicator}`, attempts: 4 });
  const rows = Array.isArray(payload?.[1]) ? payload[1] : [];
  const latestByIso3 = new Map();
  for (const row of rows) {
    if (!row?.countryiso3code || row.value === null || row.value === undefined) continue;
    if (!latestByIso3.has(row.countryiso3code)) latestByIso3.set(row.countryiso3code, row);
  }
  return { url, latestByIso3 };
}

async function bootstrapWorldBank(countries) {
  const indicators = {
    gdpCurrentUsd: 'NY.GDP.MKTP.CD',
    inflationPercent: 'FP.CPI.TOTL.ZG',
    healthExpenditurePercentGdp: 'SH.XPD.CHEX.GD.ZS',
    internetUsersPercent: 'IT.NET.USER.ZS',
    populationTotal: 'SP.POP.TOTL',
    lifeExpectancyYears: 'SP.DYN.LE00.IN',
    airPassengers: 'IS.AIR.PSGR'
  };
  const fetched = {};
  for (const [key, indicator] of Object.entries(indicators)) {
    fetched[key] = { indicator, ...(await fetchWorldBankIndicator(indicator)) };
    await sleep(THROTTLE_MS);
  }
  let stored = 0;
  for (const country of countries) {
    const point = (key) => fetched[key]?.latestByIso3.get(country.cca3) ?? null;
    const value = (key) => point(key)?.value ?? null;
    const date = (key) => point(key)?.date ?? null;
    const infrastructure = { airPassengers: value('airPassengers'), airPassengersYear: date('airPassengers') };
    const raw = Object.fromEntries(Object.keys(indicators).map((key) => [key, { indicator: fetched[key].indicator, point: point(key), url: fetched[key].url }]));
    await run(
      `insert into country_master_profiles (country_iso2, source, fetched_at, confidence, gdp_current_usd, inflation_percent, population_total, life_expectancy_years, internet_users_percent, health_expenditure_percent_gdp, infrastructure_indicators, raw_payload)
       values ($1,$2,now(),$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, gdp_current_usd = excluded.gdp_current_usd, inflation_percent = excluded.inflation_percent, population_total = excluded.population_total, life_expectancy_years = excluded.life_expectancy_years, internet_users_percent = excluded.internet_users_percent, health_expenditure_percent_gdp = excluded.health_expenditure_percent_gdp, infrastructure_indicators = excluded.infrastructure_indicators, raw_payload = excluded.raw_payload, updated_at = now()`,
      [country.cca2, 'World Bank public API', 'High', value('gdpCurrentUsd'), value('inflationPercent'), value('populationTotal'), value('lifeExpectancyYears'), value('internetUsersPercent'), value('healthExpenditurePercentGdp'), JSON.stringify(infrastructure), JSON.stringify(raw)]
    );
    await run(
      `insert into country_health_profiles (country_iso2, source, fetched_at, confidence, health_expenditure_percent_gdp, life_expectancy_years, raw_payload)
       values ($1,$2,now(),$3,$4,$5,$6::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, health_expenditure_percent_gdp = excluded.health_expenditure_percent_gdp, life_expectancy_years = excluded.life_expectancy_years, raw_payload = excluded.raw_payload, updated_at = now()`,
      [country.cca2, 'World Bank public API', 'High', value('healthExpenditurePercentGdp'), value('lifeExpectancyYears'), JSON.stringify(raw)]
    );
    await run(
      `insert into country_infrastructure_profiles (country_iso2, source, fetched_at, confidence, internet_users_percent, infrastructure_indicators, raw_payload)
       values ($1,$2,now(),$3,$4,$5::jsonb,$6::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, internet_users_percent = excluded.internet_users_percent, infrastructure_indicators = excluded.infrastructure_indicators, raw_payload = excluded.raw_payload, updated_at = now()`,
      [country.cca2, 'World Bank public API', 'High', value('internetUsersPercent'), JSON.stringify(infrastructure), JSON.stringify(raw)]
    );
    stored += 1;
  }
  await freshness('world-bank', 'World Bank indicators', 'live', countries.length, stored, null, false, 'High');
  stats.stored.worldBankProfiles = stored;
  return stored;
}

async function bootstrapWikidata(countries) {
  const sparql = `
    SELECT ?iso2 ?countryLabel ?capitalLabel ?governmentLabel ?timezoneLabel WHERE {
      ?country wdt:P31 wd:Q6256; wdt:P297 ?iso2.
      OPTIONAL { ?country wdt:P36 ?capital. }
      OPTIONAL { ?country wdt:P122 ?government. }
      OPTIONAL { ?country wdt:P421 ?timezone. }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
    }`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const data = await fetchJson(url, { label: 'Wikidata global country SPARQL', attempts: 5, baseDelayMs: 1800, accept: 'application/sparql-results+json' });
  const allowed = new Set(countries.map((country) => country.cca2));
  const rows = data?.results?.bindings ?? [];
  let stored = 0;
  for (const row of rows) {
    const iso2 = row.iso2?.value;
    if (!allowed.has(iso2)) continue;
    const payload = { row, url };
    await run(
      `insert into country_security_profiles (country_iso2, source, fetched_at, confidence, government_structure, raw_payload)
       values ($1,$2,now(),$3,$4,$5::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, government_structure = excluded.government_structure, raw_payload = country_security_profiles.raw_payload || excluded.raw_payload, updated_at = now()`,
      [iso2, 'Wikidata SPARQL', 'Medium', row.governmentLabel?.value ?? null, JSON.stringify(payload)]
    );
    await run(
      `insert into country_master_profiles (country_iso2, source, fetched_at, confidence, government_structure, timezone, raw_payload)
       values ($1,$2,now(),$3,$4,$5,$6::jsonb)
       on conflict (country_iso2) do update set source = excluded.source, fetched_at = excluded.fetched_at, confidence = excluded.confidence, government_structure = coalesce(excluded.government_structure, country_master_profiles.government_structure), timezone = coalesce(excluded.timezone, country_master_profiles.timezone), raw_payload = country_master_profiles.raw_payload || excluded.raw_payload, updated_at = now()`,
      [iso2, 'Wikidata SPARQL', 'Medium', row.governmentLabel?.value ?? null, row.timezoneLabel?.value ?? null, JSON.stringify(payload)]
    );
    await sourceReference({ sourceKey: 'wikidata', sourceName: 'Wikidata', sourceType: 'Public structured data', title: `${iso2} Wikidata country context`, url, countryIso2: iso2, confidence: 'Medium', rawPayload: payload });
    stored += 1;
  }
  await freshness('wikidata', 'Wikidata SPARQL', stored ? 'live' : 'unavailable', countries.length, stored, stored ? null : 'No Wikidata country rows matched.', false, stored ? 'Medium' : 'Low');
  stats.stored.wikidataProfiles = stored;
  return stored;
}

async function storePoi(country, type, queryText, cityName) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=${country.cca2.toLowerCase()}&q=${encodeURIComponent(queryText)}`;
  const data = await fetchJson(url, { label: `OSM ${country.cca2} ${type}`, attempts: 3 });
  await sleep(OSM_THROTTLE_MS);
  let stored = 0;
  for (const poi of data ?? []) {
    const name = clean(poi.display_name || poi.name || `${type} candidate`);
    const lat = Number.isFinite(Number(poi.lat)) ? Number(poi.lat) : null;
    const lon = Number.isFinite(Number(poi.lon)) ? Number(poi.lon) : null;
    const rows = await run(
      `insert into location_pois (country_iso2, city_name, poi_type, name, latitude, longitude, address, source, source_url, confidence, fetched_at, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),$11::jsonb)
       on conflict do nothing returning id`,
      [country.cca2, cityName, type, name, lat, lon, name, 'OpenStreetMap Nominatim', url, 'Medium', JSON.stringify(poi)]
    );
    if (rows.length) {
      stored += 1;
      stats.stored.pois += 1;
    } else {
      stats.skippedDuplicates += 1;
    }
    if (type === 'hotels' && name && !/^hotel$/i.test(name)) {
      const hotelRows = await run(
        `insert into hotel_candidates (country_iso2, city_name, name, latitude, longitude, address, source, source_url, confidence, fetched_at, raw_payload)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10::jsonb)
         on conflict do nothing returning id`,
        [country.cca2, cityName, name, lat, lon, name, 'OpenStreetMap Nominatim', url, 'Medium', JSON.stringify(poi)]
      );
      if (hotelRows.length) stats.stored.hotels += 1;
      else stats.skippedDuplicates += 1;
    }
  }
  return stored;
}

async function bootstrapOsm(countries) {
  if (OSM_MODE === 'off') {
    await freshness('osm', 'OpenStreetMap Nominatim', 'missing_key', 0, 0, 'BOOTSTRAP_OSM_MODE=off.', false, 'Low');
    return 0;
  }
  const selected = OSM_COUNTRY_LIMIT > 0 ? countries.slice(0, OSM_COUNTRY_LIMIT) : countries;
  let stored = 0;
  for (const [index, country] of selected.entries()) {
    const capital = country.capital?.[0];
    if (!capital) continue;
    if ((index + 1) % 10 === 0) console.log(`OSM progress: ${index + 1}/${selected.length} countries`);
    try {
      stored += await storePoi(country, 'hotels', `business hotel ${capital}`, capital);
      stored += await storePoi(country, 'hospitals', `hospital ${capital}`, capital);
      stored += await storePoi(country, 'airports', `airport ${capital}`, capital);
    } catch (error) {
      stats.failures += 1;
      console.warn(`OSM ${country.cca2}: ${error.message}`);
    }
  }
  await freshness('osm', 'OpenStreetMap Nominatim', stored ? 'live' : 'unavailable', selected.length, stored, stored ? null : 'No OSM POIs stored.', false, stored ? 'Medium' : 'Low');
  return stored;
}

async function storeAdvisory(source, title, summary, url, publishedAt, country, rawPayload) {
  const severity = severityFromText(`${title} ${summary}`);
  const rows = await run(
    `with incoming as (
       select
         cast($1 as text) as country_iso2,
         cast($2 as text) as source,
         cast($3 as text) as level,
         cast($4 as text) as title,
         cast($5 as text) as body,
         cast($6 as text) as url,
         cast($7 as timestamptz) as published_at,
         cast($8 as text) as source_url,
         cast($9 as text) as severity,
         cast($10 as text) as summary,
         cast($11 as timestamptz) as issued_at,
         cast($12 as text) as status,
         cast($13 as text) as confidence,
         cast($14 as jsonb) as raw_payload
     )
     insert into advisories (
       country_iso2, source, level, title, body, url,
       published_at, source_url, severity, summary,
       issued_at, status, confidence, raw_payload
     )
     select
       country_iso2, source, level, title, body, url,
       published_at, source_url, severity, summary,
       issued_at, status, confidence, raw_payload
     from incoming
     where not exists (
       select 1
       from advisories a
       join incoming i on true
       where a.source = i.source
         and a.title = i.title
         and coalesce(a.country_iso2::text, '') = coalesce(i.country_iso2, '')
         and coalesce(a.issued_at, a.published_at, a.ingested_at)::date =
             coalesce(i.issued_at, i.published_at, now())::date
     )
     returning id`,
    [country?.cca2 ? String(country.cca2) : null, source, severity, title, summary || title, url || null, publishedAt, url || null, severity, summary || title, publishedAt, 'live', country ? 'High' : 'Medium', JSON.stringify(rawPayload ?? {})]
  );
  if (rows.length) stats.stored.advisories += 1;
  else stats.skippedDuplicates += 1;
  await sourceReference({ sourceKey: normalize(source).replace(/\s+/g, '-'), sourceName: source, sourceType: 'Travel advisory', title, url, countryIso2: country?.cca2, confidence: country ? 'High' : 'Medium', publishedAt, rawPayload });
  return rows.length;
}

function relevanceForEvent(source, title, summary, publishedAt, matchedCountry) {
  const trust = sourceTrust(source);
  const geo = matchedCountry ? 0.9 : 0.12;
  const fresh = freshnessWeight(publishedAt);
  const severity = severityFromText(`${title} ${summary}`);
  const impact = operationalImpact(title, summary, severity);
  const noisyCap = /(gdelt|rss|news)/i.test(source) ? 0.72 : 1;
  const relevanceScore = Math.round(100 * trust * geo * fresh * impact * noisyCap);
  return { severity, relevanceScore, sourceTrust: trust, geoConfidence: geo, freshnessWeight: fresh, operationalImpact: impact };
}

async function storeEvent(source, title, summary, url, publishedAt, country, rawPayload, category = 'Live Travel Intelligence') {
  const relevance = relevanceForEvent(source, title, summary, publishedAt, country);
  if (!country || relevance.relevanceScore < 35) {
    await sourceReference({ sourceKey: normalize(source).replace(/\s+/g, '-'), sourceName: source, sourceType: 'Global monitoring context', title, url, confidence: 'Low', publishedAt, rawPayload: { ...rawPayload, relevance } });
    return 0;
  }
  const rows = await run(
    `insert into risk_events (title, country_iso2, city_name, category, severity, source, summary, recommended_action, event_time, confidence, status, raw_payload, relevance_score, source_trust, geo_confidence, freshness_weight, operational_impact)
     select $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,$17
     where not exists (
       select 1 from risk_events
       where source = $6
         and title = $1
         and coalesce(country_iso2::text, '') = coalesce($2::text, '')
         and coalesce(city_name, '') = coalesce($3::text, '')
         and coalesce(event_time, occurred_at)::date = coalesce($9::timestamptz, now())::date
     )
     returning id`,
    [title, country.cca2, null, category, relevance.severity, source, summary || title, 'Review source relevance and update destination/trip controls if confirmed.', publishedAt, confidenceFromRelevance(relevance.relevanceScore), 'pending', JSON.stringify(rawPayload ?? {}), relevance.relevanceScore, relevance.sourceTrust, relevance.geoConfidence, relevance.freshnessWeight, relevance.operationalImpact]
  );
  if (rows.length) stats.stored.events += 1;
  else stats.skippedDuplicates += 1;
  await sourceReference({ sourceKey: normalize(source).replace(/\s+/g, '-'), sourceName: source, sourceType: category, title, url, countryIso2: country.cca2, confidence: confidenceFromRelevance(relevance.relevanceScore), publishedAt, rawPayload: { ...rawPayload, relevance } });
  return rows.length;
}

async function bootstrapFcdoSearch(countries, matchCountry) {
  const url = process.env.UK_FCDO_API_URL || 'https://www.gov.uk/api/search.json?filter_format=travel_advice&count=100';
  const data = await fetchJson(url, { label: 'GOV.UK FCDO search', attempts: 4 });
  const items = Array.isArray(data?.results) ? data.results : Array.isArray(data?.items) ? data.items : [];
  let stored = 0;
  for (const item of items) {
    const title = clean(item.title ?? 'FCDO travel advice');
    const summary = clean(item.description ?? item.summary ?? 'FCDO advisory item received.');
    const country = matchCountry(title, summary);
    const link = item.link || item.url || '';
    const sourceUrl = link ? `https://www.gov.uk${String(link).startsWith('/') ? link : `/${link}`}` : url;
    stored += await storeAdvisory('UK FCDO GOV.UK Content API', title, summary, sourceUrl, item.public_timestamp || item.updated_at || new Date().toISOString(), country, item);
  }
  await freshness('fcdo', 'UK FCDO GOV.UK Content API', stored ? 'live' : 'unavailable', items.length, stored, stored ? null : 'No FCDO advisory rows stored.', true, 'High');
  return stored;
}

async function bootstrapRssLike(sourceKey, sourceName, urls, matchCountry, category = 'Live Travel Intelligence') {
  if (!urls.length) {
    await freshness(sourceKey, sourceName, 'missing_key', 0, 0, `${sourceKey} not configured.`, false, 'Low');
    return 0;
  }
  let fetched = 0;
  let stored = 0;
  const errors = [];
  for (const url of urls) {
    try {
      const xml = await fetchText(url, { label: `${sourceName} ${url}`, attempts: 3 });
      const items = parseRss(xml);
      fetched += items.length;
      for (const item of items) {
        const country = matchCountry(item.title, item.summary);
        stored += await storeEvent(sourceName, item.title, item.summary, item.link || url, item.publishedAt || new Date().toISOString(), country, item, category);
      }
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
      stats.failures += 1;
      console.warn(`${sourceName}: ${error.message}`);
    }
    await sleep(THROTTLE_MS);
  }
  await freshness(sourceKey, sourceName, stored ? 'live' : 'unavailable', fetched, stored, errors.join('; ') || null, false, stored ? 'Medium' : 'Low');
  return stored;
}

async function bootstrapUsgs(matchCountry) {
  const url = process.env.USGS_EARTHQUAKE_FEED_URL || 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson';
  const data = await fetchJson(url, { label: 'USGS significant earthquakes', attempts: 4 });
  let stored = 0;
  for (const feature of data.features ?? []) {
    const props = feature.properties ?? {};
    const title = clean(props.title || 'USGS earthquake event');
    const summary = clean(`Magnitude ${props.mag ?? 'unknown'} earthquake. ${props.place ?? ''}`);
    const country = matchCountry(title, summary);
    stored += await storeEvent('USGS Earthquake Hazards Program', title, summary, props.url || url, props.time ? new Date(props.time).toISOString() : new Date().toISOString(), country, feature, 'Natural hazards');
  }
  await freshness('usgs', 'USGS earthquakes', 'live', data.features?.length ?? 0, stored, null, false, 'High');
  return stored;
}

async function bootstrapGdelt(matchCountry) {
  const url = process.env.GDELT_API_URL;
  if (!url) {
    await freshness('gdelt', 'GDELT/news events', 'missing_key', 0, 0, 'GDELT_API_URL not configured.', false, 'Low');
    return 0;
  }
  try {
    const data = await fetchJson(url, { label: 'GDELT public endpoint', attempts: 3, baseDelayMs: 2500 });
    const articles = Array.isArray(data?.articles) ? data.articles : Array.isArray(data?.results) ? data.results : [];
    let stored = 0;
    for (const article of articles.slice(0, 80)) {
      const title = clean(article.title ?? article.seendate ?? 'GDELT event');
      const summary = clean(article.summary ?? article.domain ?? 'GDELT/news item received.');
      const country = matchCountry(title, summary);
      stored += await storeEvent('GDELT/news events', title, summary, article.url || url, article.seendate || new Date().toISOString(), country, article);
    }
    await freshness('gdelt', 'GDELT/news events', 'live', articles.length, stored, null, false, 'Medium');
    return stored;
  } catch (error) {
    await freshness('gdelt', 'GDELT/news events', 'unavailable', 0, 0, error.message, false, 'Low');
    stats.failures += 1;
    return 0;
  }
}

async function bootstrapOfficialConfigured(matchCountry) {
  const urls = (process.env.OFFICIAL_PAGE_URLS || '').split(',').map((item) => item.trim()).filter(Boolean);
  if (!urls.length) {
    await freshness('official-page-extractor', 'Official page extractor', 'missing_key', 0, 0, 'OFFICIAL_PAGE_URLS not configured.', false, 'Low');
    return 0;
  }
  let stored = 0;
  for (const url of urls.slice(0, 25)) {
    try {
      const text = await fetchText(url, { label: `Official extraction ${url}`, attempts: 3 });
      const country = matchCountry(url, text.slice(0, 2000));
      const rows = await run(
        `insert into official_page_extractions (country_iso2, source_url, title, extracted_text, extraction_method, confidence, fetched_at, raw_payload)
         values ($1,$2,$3,$4,$5,$6,now(),$7::jsonb)
         on conflict do nothing returning id`,
        [country?.cca2 ?? null, url, `Official page extraction ${url}`, text.slice(0, 12000), 'controlled-public-page-fetch', country ? 'Medium' : 'Low', JSON.stringify({ length: text.length })]
      );
      if (rows.length) stored += 1;
      else stats.skippedDuplicates += 1;
    } catch (error) {
      stats.failures += 1;
      console.warn(`Official extraction ${url}: ${error.message}`);
    }
    await sleep(THROTTLE_MS);
  }
  await freshness('official-page-extractor', 'Official page extractor', stored ? 'live' : 'unavailable', urls.length, stored, stored ? null : 'No official pages stored.', false, stored ? 'Medium' : 'Low');
  return stored;
}

async function main() {
  const startedAt = Date.now();
  console.log('Atlas Insight global bootstrap starting...');
  console.log(`Mode: countries=${process.env.BOOTSTRAP_COUNTRY_CODES || 'ALL'}, osm=${OSM_MODE}, osmLimit=${OSM_COUNTRY_LIMIT || 'ALL'}, throttle=${THROTTLE_MS}ms`);
  await ensureSchema();

  const summary = [];
  const provider = async (name, fn) => {
    stats.providers += 1;
    console.log(`\n[provider ${stats.providers}] ${name} starting...`);
    try {
      const result = await fn();
      const count = Array.isArray(result) ? result.length : result;
      summary.push([name, count, 'ok']);
      console.log(`[provider ${stats.providers}] ${name}: ${count} stored/processed`);
      await sleep(THROTTLE_MS);
      return result;
    } catch (error) {
      stats.failures += 1;
      summary.push([name, 0, error.message]);
      console.warn(`[provider ${stats.providers}] ${name} failed: ${error.message}`);
      await sleep(THROTTLE_MS);
      return 0;
    }
  };

  const countries = await provider('rest-countries', bootstrapRestCountries);
  const matchCountry = buildCountryMatcher(countries);

  await provider('world-bank', () => bootstrapWorldBank(countries));
  await provider('wikidata', () => bootstrapWikidata(countries));
  await provider('fcdo', () => bootstrapFcdoSearch(countries, matchCountry));
  await provider('smartraveller/rss', () => bootstrapRssLike('smartraveller', 'Australia Smartraveller', [process.env.AU_SMARTRAVELLER_API_URL || 'https://www.smartraveller.gov.au/rss'], matchCountry, 'Travel advisory'));
  await provider('gdacs/rss', () => bootstrapRssLike('gdacs', 'GDACS disaster alerts', [process.env.DISASTER_FEED_URL || 'https://www.gdacs.org/xml/rss.xml'], matchCountry, 'Natural hazards'));
  await provider('usgs', () => bootstrapUsgs(matchCountry));
  await provider('health/rss', () => bootstrapRssLike('health', 'Health outbreak feeds', process.env.HEALTH_OUTBREAK_FEED_URL ? [process.env.HEALTH_OUTBREAK_FEED_URL] : [], matchCountry, 'Health'));
  await provider('public-rss', () => bootstrapRssLike('public-rss', 'Public RSS feeds', (process.env.NEWS_RSS_FEEDS || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 12), matchCountry));
  await provider('gdelt', () => bootstrapGdelt(matchCountry));
  await provider('official-page-extractor', () => bootstrapOfficialConfigured(matchCountry));
  await provider('osm', () => bootstrapOsm(countries));

  console.log('\nAtlas Insight global bootstrap complete.');
  for (const [name, count, status] of summary) console.log(`- ${name}: ${count} (${status})`);
  console.log(`\nProgress summary: countries=${stats.countries}, capitals=${stats.capitals}, providers=${stats.providers}, failures=${stats.failures}, skippedDuplicates=${stats.skippedDuplicates}`);
  console.log(`Stored: ${JSON.stringify(stats.stored, null, 2)}`);
  console.log(`Runtime: ${Math.round((Date.now() - startedAt) / 1000)} seconds`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
