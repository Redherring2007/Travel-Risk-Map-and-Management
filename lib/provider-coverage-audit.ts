import { countries, alerts } from './data';
import { envChecks } from './env';
import { filterRelevantEvents, scoreEventRelevance, type EventEvidenceLike } from './event-relevance';
import { isNeonConfigured, query } from './neon';
import { providerHealth, type ProviderHealth } from './provider-status';
import { providers } from './providers';

export type ConfidenceCategory = 'Verified' | 'High confidence' | 'Moderate confidence' | 'Low confidence' | 'Manual review required';

type FreshnessRow = {
  source_key: string;
  source_name: string;
  status: string;
  last_success_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
  records_fetched: number | null;
  records_stored: number | null;
  freshness_minutes: number | null;
};

type CountRow = { key: string; count: string | number };

type CountryCoverageRow = {
  iso2: string;
  advisory_count: string | number | null;
  source_count: string | number | null;
};

type EventCoverageRow = EventEvidenceLike & {
  country_iso2: string | null;
  city_name: string | null;
  source: string;
  severity: string | null;
  event_time: string | null;
  occurred_at: string | null;
};

export type ProviderCoverageItem = ProviderHealth & {
  configured: boolean;
  active: boolean;
  fallback: boolean;
  stale: boolean;
  lastRun?: string;
  recordsStored: number;
  trustWeight: number;
};

export type ConfidenceScore = {
  score: number;
  category: ConfidenceCategory;
  drivers: string[];
  penalties: string[];
};

export type ProviderCoverageAudit = {
  generatedAt: string;
  providerCoverage: ProviderCoverageItem[];
  missingFeeds: Array<{ key: string; label: string; domain: string; recommendation: string; priority: 'High' | 'Medium' | 'Low'; sourceClass: string; implementationDifficulty: 'Low' | 'Medium' | 'High'; expectedConfidenceUplift: string; analystValidationRequired: boolean }>;
  fallbackUsage: Array<{ provider: string; reason: string }>;
  staleSources: Array<{ provider: string; lastRun?: string; reason: string }>;
  countryCoverage: Array<{
    iso2: string;
    country: string;
    score: number;
    category: ConfidenceCategory;
    advisoryCompleteness: ConfidenceCategory;
    eventCompleteness: ConfidenceCategory;
    sourceCount: number;
    advisories: number;
    events: number;
    highConfidenceEvents: number;
    capped: boolean;
    gaps: string[];
  }>;
  confidenceAssessment: {
    reportConfidence: ConfidenceScore;
    routeConfidence: ConfidenceScore;
    hotelConfidence: ConfidenceScore;
    healthConfidence: ConfidenceScore;
    operationalConfidence: ConfidenceScore;
  };
  recommendedNextFeeds: Array<{ domain: string; envVar: string; guidance: string; priority: 'High' | 'Medium' | 'Low'; sourceClass: string; implementationDifficulty: 'Low' | 'Medium' | 'High'; expectedConfidenceUplift: string; analystValidationRequired: boolean }>;
  adminReviewRecommendations: Array<{ area: string; recommendation: string; futureStructure: string }>;
};

const OFFICIAL_PROVIDER_PATTERNS = /(fcdo|state|canada|smartraveller|mfat|gdacs|usgs|rest countries|world bank|who|cdc|government|official)/i;
const STALE_MS = 1000 * 60 * 60 * 24 * 7;
const FRESH_72H_MS = 1000 * 60 * 60 * 72;

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function configuredEnv(keys: string[]) {
  return keys.length > 0 && keys.every((key) => Boolean(process.env[key]));
}

function category(score: number): ConfidenceCategory {
  if (score >= 90) return 'Verified';
  if (score >= 75) return 'High confidence';
  if (score >= 55) return 'Moderate confidence';
  if (score >= 35) return 'Low confidence';
  return 'Manual review required';
}

function categoryWithCap(score: number, cap: number): ConfidenceCategory {
  return category(Math.min(score, cap));
}

function isStale(lastRun?: string | null) {
  if (!lastRun) return true;
  const time = new Date(lastRun).getTime();
  return !Number.isFinite(time) || Date.now() - time > STALE_MS;
}

function isFresh72(lastRun?: string | null) {
  if (!lastRun) return false;
  const time = new Date(lastRun).getTime();
  return Number.isFinite(time) && Date.now() - time <= FRESH_72H_MS;
}

function domainForEnv(key: string) {
  if (/FCDO|STATE|CANADA|SMARTRAVELLER|MFAT/.test(key)) return 'Official travel advisories';
  if (/RSS|GDELT|NEWS/.test(key)) return 'Live incident and news monitoring';
  if (/HEALTH|WHO|CDC/.test(key)) return 'Health and outbreak intelligence';
  if (/AVIATION|AIRPORT/.test(key)) return 'Aviation and airport disruption';
  if (/DISASTER|USGS|WEATHER|GDACS/.test(key)) return 'Natural hazard and disaster monitoring';
  if (/MAPBOX|OSM|NOMINATIM/.test(key)) return 'Mapping and location intelligence';
  return 'Operational data source';
}

function feedRecommendationMeta(key: string) {
  if (/FCDO|STATE|CANADA|SMARTRAVELLER|MFAT/.test(key)) {
    return { priority: 'High' as const, sourceClass: 'free/public/official', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'High uplift for advisory confidence and report trust.', analystValidationRequired: false };
  }
  if (/HEALTH|WHO|CDC/.test(key)) {
    return { priority: 'High' as const, sourceClass: 'free/public/official or official page extraction', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'High uplift for health and medical confidence.', analystValidationRequired: true };
  }
  if (/DISASTER|USGS|WEATHER|GDACS/.test(key)) {
    return { priority: 'High' as const, sourceClass: 'free/public official plus paid optional weather', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'High uplift for disaster, weather and travel disruption confidence.', analystValidationRequired: false };
  }
  if (/AVIATION/.test(key)) {
    return { priority: 'Medium' as const, sourceClass: 'paid optional/API required', implementationDifficulty: 'High' as const, expectedConfidenceUplift: 'Medium uplift for airport and flight disruption confidence.', analystValidationRequired: true };
  }
  if (/RSS|GDELT|NEWS/.test(key)) {
    return { priority: 'Medium' as const, sourceClass: 'free/public API or curated RSS', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'Medium uplift for incident discovery; confidence depends on relevance filtering.', analystValidationRequired: true };
  }
  if (/OFFICIAL_PAGE|EMBASSY|CONSULAR/.test(key)) {
    return { priority: 'Medium' as const, sourceClass: 'manual/official page extraction', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'Medium uplift for consular and emergency context.', analystValidationRequired: true };
  }
  return { priority: 'Low' as const, sourceClass: 'configuration dependent', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'Targeted uplift depending on destination and itinerary.', analystValidationRequired: true };
}

function scoreConfidence(input: {
  officialSources: number;
  liveSources: number;
  fallbackSources: number;
  staleSources: number;
  missingCriticalFeeds: number;
  evidenceGate?: EvidenceGate;
  conflictingSources?: number;
  domainGaps?: string[];
}): ConfidenceScore {
  let score = 45;
  const drivers: string[] = [];
  const penalties: string[] = [];

  if (input.liveSources) {
    score += Math.min(25, input.liveSources * 5);
    drivers.push(`${input.liveSources} live/public source${input.liveSources === 1 ? '' : 's'} available`);
  }
  if (input.officialSources) {
    score += Math.min(20, input.officialSources * 6);
    drivers.push(`${input.officialSources} official/public authority source${input.officialSources === 1 ? '' : 's'} available`);
  }
  if (input.fallbackSources) {
    const penalty = Math.min(30, input.fallbackSources * 6);
    score -= penalty;
    penalties.push(`${input.fallbackSources} provider${input.fallbackSources === 1 ? '' : 's'} in fallback or unavailable state`);
  }
  if (input.staleSources) {
    const penalty = Math.min(24, input.staleSources * 6);
    score -= penalty;
    penalties.push(`${input.staleSources} stale source${input.staleSources === 1 ? '' : 's'}`);
  }
  if (input.missingCriticalFeeds) {
    const penalty = Math.min(28, input.missingCriticalFeeds * 7);
    score -= penalty;
    penalties.push(`${input.missingCriticalFeeds} critical feed${input.missingCriticalFeeds === 1 ? '' : 's'} missing`);
  }
  if (input.conflictingSources) {
    const penalty = Math.min(16, input.conflictingSources * 8);
    score -= penalty;
    penalties.push('Potential conflicting-source review required');
  }
  for (const gap of input.domainGaps ?? []) penalties.push(gap);

  const cap = confidenceCap(input.evidenceGate);
  if (cap < 100) penalties.push(`Confidence capped at ${cap} until official, fresh, low-fallback and relevant evidence gates are satisfied.`);
  const bounded = Math.max(0, Math.min(cap, Math.round(score)));
  return { score: bounded, category: categoryWithCap(bounded, cap), drivers, penalties };
}

type EvidenceGate = {
  officialAdvisoryProvidersLive: number;
  allRequiredFresh72h: boolean;
  criticalFeedsConfigured: boolean;
  fallbackUsageLow: boolean;
  eventRelevanceHigh: boolean;
};

function confidenceCap(gate?: EvidenceGate) {
  if (!gate) return 85;
  const verifiedAllowed = gate.officialAdvisoryProvidersLive >= 2
    && gate.allRequiredFresh72h
    && gate.criticalFeedsConfigured
    && gate.fallbackUsageLow
    && gate.eventRelevanceHigh;
  if (verifiedAllowed) return 100;
  if (gate.officialAdvisoryProvidersLive >= 1 && gate.criticalFeedsConfigured && gate.fallbackUsageLow) return 85;
  if (gate.officialAdvisoryProvidersLive >= 1) return 75;
  return 65;
}

function evidenceGate(coverage: ProviderCoverageItem[], eventRelevanceHigh: boolean): EvidenceGate {
  const officialKeys = ['uk-fcdo', 'us-state', 'canada-advisories', 'smartraveller', 'nz-mfat'];
  const officialAdvisoryProvidersLive = coverage.filter((item) => officialKeys.includes(item.key) && item.active && !item.fallback).length;
  const requiredFresh = coverage.filter((item) => ['travel_advice', 'live_incidents'].includes(item.category) && item.configured);
  const allRequiredFresh72h = requiredFresh.length > 0 && requiredFresh.every((item) => isFresh72(item.lastRun));
  const criticalFeedsConfigured = ['health-outbreaks', 'weather-disaster', 'rss-news'].every((key) => Boolean(coverage.find((item) => item.key === key)?.configured));
  const fallbackUsageLow = coverage.filter((item) => item.fallback).length <= Math.max(1, Math.floor(coverage.length * 0.2));
  return { officialAdvisoryProvidersLive, allRequiredFresh72h, criticalFeedsConfigured, fallbackUsageLow, eventRelevanceHigh };
}

async function freshnessRows(): Promise<FreshnessRow[]> {
  if (!isNeonConfigured()) return [];
  return query<FreshnessRow>('select source_key, source_name, status, last_success_at, last_attempt_at, last_error, records_fetched, records_stored, freshness_minutes from data_source_freshness order by last_attempt_at desc').catch(() => []);
}

async function tableCounts() {
  if (!isNeonConfigured()) return { advisories: 0, riskEvents: 0, sourceReferences: 0, hotelCandidates: 0, routeSegments: 0 };
  const [advisories, riskEvents, sourceReferences, hotelCandidates, routeSegments] = await Promise.all([
    query<CountRow>('select count(*) as count from advisories').catch(() => []),
    query<CountRow>('select count(*) as count from risk_events').catch(() => []),
    query<CountRow>('select count(*) as count from source_references').catch(() => []),
    query<CountRow>('select count(*) as count from hotel_candidates').catch(() => []),
    query<CountRow>('select count(*) as count from route_risk_segments').catch(() => [])
  ]);
  return {
    advisories: numberValue(advisories[0]?.count),
    riskEvents: numberValue(riskEvents[0]?.count),
    sourceReferences: numberValue(sourceReferences[0]?.count),
    hotelCandidates: numberValue(hotelCandidates[0]?.count),
    routeSegments: numberValue(routeSegments[0]?.count)
  };
}

async function countryRows(): Promise<CountryCoverageRow[]> {
  if (!isNeonConfigured()) return [];
  return query<CountryCoverageRow>(
    `select c.iso2,
      coalesce(a.advisory_count, 0) as advisory_count,
      coalesce(s.source_count, 0) as source_count
     from countries c
     left join (select country_iso2, count(*) as advisory_count from advisories group by country_iso2) a on a.country_iso2 = c.iso2
     left join (select country_iso2, count(distinct source_key) as source_count from source_references group by country_iso2) s on s.country_iso2 = c.iso2
     order by c.iso2`
  ).catch(() => []);
}

async function eventRows(): Promise<EventCoverageRow[]> {
  if (!isNeonConfigured()) return [];
  return query<EventCoverageRow>(
    `select title, country_iso2, city_name, category, severity, source, summary, event_time, occurred_at, confidence, status, raw_payload
     from risk_events
     where coalesce(status, '') not in ('demo_fallback', 'provider_status')
       and lower(coalesce(title, '')) not like '%demo fallback%'
       and lower(coalesce(category, '')) not like '%provider status%'
     order by coalesce(event_time, occurred_at) desc
     limit 2000`
  ).catch(() => []);
}

function providerCoverage(freshness: FreshnessRow[]): ProviderCoverageItem[] {
  const health = providerHealth();
  return health.map((provider) => {
    const fresh = freshness.find((row) => row.source_key === provider.key || row.source_name === provider.name);
    const publicProvider = provider.envVars.length === 0;
    const configured = publicProvider || configuredEnv(provider.envVars);
    const active = provider.status === 'Live provider active' || provider.status === 'Public data active' || fresh?.status === 'live';
    const fallback = provider.status === 'Demo fallback active' || fresh?.status === 'demo_fallback' || fresh?.status === 'unavailable';
    const lastRun = fresh?.last_success_at ?? fresh?.last_attempt_at ?? undefined;
    const stale = !publicProvider && isStale(lastRun);
    const trustWeight = OFFICIAL_PROVIDER_PATTERNS.test(provider.name) ? 1 : provider.category === 'live_incidents' ? 0.75 : 0.6;
    return { ...provider, configured, active, fallback, stale, lastRun, recordsStored: numberValue(fresh?.records_stored), trustWeight };
  });
}

function missingFeeds(coverage: ProviderCoverageItem[]) {
  const missingEnv = envChecks().filter((item) => !item.configured && /(ADVISORY|RSS|GDELT|HEALTH|AVIATION|DISASTER|WEATHER|MAPBOX)/.test(item.key));
  return missingEnv.map((item) => ({
    key: item.key,
    label: item.label,
    domain: domainForEnv(item.key),
    recommendation: `Configure ${item.key} with a public/free/official feed or approved provider endpoint. Do not use unverified scraped content as authoritative evidence.`,
    ...feedRecommendationMeta(item.key)
  })).concat(
    coverage.filter((item) => !item.configured && item.envVars.length > 0).map((item) => ({
      key: item.key,
      label: item.name,
      domain: item.category,
      recommendation: `Provider requires ${item.envVars.join(', ')} before it can contribute production confidence.`,
      ...feedRecommendationMeta(item.envVars[0] ?? item.key)
    }))
  ).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]));
}

function recommendedNextFeeds() {
  return [
    { domain: 'Official travel advisories', envVar: 'UK_FCDO_API_URL / US_STATE_ADVISORY_API_URL / CANADA_ADVISORY_API_URL / AU_SMARTRAVELLER_API_URL / NZ_MFAT_ADVISORY_API_URL', guidance: 'Connect official advisory feeds or controlled official-page extraction for destination-specific advisory positions.', priority: 'High' as const, sourceClass: 'free/public/official', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'High', analystValidationRequired: false },
    { domain: 'Health and outbreak intelligence', envVar: 'HEALTH_OUTBREAK_FEED_URL', guidance: 'Configure an official WHO, CDC, ECDC or national public-health feed where licensing and access permit.', priority: 'High' as const, sourceClass: 'free/public/official or official page extraction', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'High', analystValidationRequired: true },
    { domain: 'Disaster and weather alerts', envVar: 'DISASTER_FEED_URL / USGS_EARTHQUAKE_FEED_URL / WEATHER_API_KEY', guidance: 'Use public GDACS/USGS feeds and a vetted weather alert provider for country and route disruption context.', priority: 'High' as const, sourceClass: 'free/public official plus paid optional weather', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'High', analystValidationRequired: false },
    { domain: 'Live incident monitoring', envVar: 'NEWS_RSS_FEEDS / GDELT_API_URL', guidance: 'Use curated public RSS and GDELT feeds; require country/coordinate relevance before treating items as trip risk drivers.', priority: 'Medium' as const, sourceClass: 'free/public API or curated RSS', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'Medium', analystValidationRequired: true },
    { domain: 'Aviation and airport disruption', envVar: 'AVIATIONSTACK_API_KEY', guidance: 'Connect an aviation disruption provider and map alerts to itinerary airports before scoring airport risk.', priority: 'Medium' as const, sourceClass: 'paid optional/API required', implementationDifficulty: 'High' as const, expectedConfidenceUplift: 'Medium', analystValidationRequired: true },
    { domain: 'Embassy and consular context', envVar: 'OFFICIAL_PAGE_URLS', guidance: 'Maintain a controlled list of official embassy/consular pages for extraction and analyst validation.', priority: 'Medium' as const, sourceClass: 'manual/official page extraction', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'Medium', analystValidationRequired: true },
    { domain: 'Sanctions and political instability', envVar: 'OFFICIAL_PAGE_URLS / NEWS_RSS_FEEDS', guidance: 'Use official government sanctions pages and curated public political-risk feeds; add analyst review before client-facing conclusions.', priority: 'Low' as const, sourceClass: 'manual/official page extraction and curated RSS', implementationDifficulty: 'High' as const, expectedConfidenceUplift: 'Targeted', analystValidationRequired: true },
    { domain: 'Maritime alerts', envVar: 'OFFICIAL_PAGE_URLS / NEWS_RSS_FEEDS', guidance: 'Add official maritime authority or piracy reporting feeds only for trips with maritime exposure.', priority: 'Low' as const, sourceClass: 'free/public official or paid optional', implementationDifficulty: 'Medium' as const, expectedConfidenceUplift: 'Targeted', analystValidationRequired: true }
  ];
}

function countryCoverage(rows: CountryCoverageRow[], eventsByCountry: Map<string, EventCoverageRow[]>, gate: EvidenceGate) {
  if (!rows.length) {
    return countries.map((country) => {
      const countryAlerts = alerts.filter((alert) => alert.country === country.name && !/demo fallback/i.test(alert.title));
      const score = Math.max(15, Math.min(45, 15 + countryAlerts.length * 8));
      return {
        iso2: country.iso2,
        country: country.name,
        score,
        category: category(score),
        advisoryCompleteness: countryAlerts.length ? 'Low confidence' as ConfidenceCategory : 'Manual review required' as ConfidenceCategory,
        eventCompleteness: 'Manual review required' as ConfidenceCategory,
        sourceCount: 0,
        advisories: countryAlerts.length,
        events: 0,
        highConfidenceEvents: 0,
        capped: true,
        gaps: ['Neon source coverage not populated or unavailable; local demo records cannot support commercial confidence.']
      };
    });
  }
  return rows.map((row) => {
    const advisories = numberValue(row.advisory_count);
    const sourceCount = numberValue(row.source_count);
    const countryEvents = eventsByCountry.get(row.iso2) ?? [];
    const relevantEvents = filterRelevantEvents(countryEvents, row.iso2, undefined, 55);
    const highConfidenceEvents = relevantEvents.filter((event) => event.relevance.relevanceScore >= 70).length;
    const eventInfluence = Math.min(18, relevantEvents.reduce((total, event) => total + Math.min(2.5, event.relevance.relevanceScore / 35), 0));
    const rawScore = Math.round(sourceCount * 9 + Math.min(26, advisories * 9) + eventInfluence);
    const cap = confidenceCap({ ...gate, eventRelevanceHigh: highConfidenceEvents >= 2 && relevantEvents.length / Math.max(countryEvents.length, 1) >= 0.15 });
    const score = Math.min(cap, rawScore);
    const gaps = [
      advisories === 0 && 'No stored official advisory for this country.',
      relevantEvents.length === 0 && 'No high-confidence destination-relevant event coverage.',
      countryEvents.length > relevantEvents.length && `${countryEvents.length - relevantEvents.length} noisy/weak-relevance event records excluded from confidence scoring.`,
      sourceCount < 3 && 'Fewer than three distinct source references.',
      cap < 100 && `Confidence capped at ${cap}; verified confidence requires two live official advisories, <72h freshness, critical feeds configured, low fallback usage and high event relevance.`
    ].filter(Boolean) as string[];
    const country = countries.find((item) => item.iso2 === row.iso2)?.name ?? row.iso2;
    return { iso2: row.iso2, country, score, category: categoryWithCap(score, cap), advisoryCompleteness: categoryWithCap(Math.min(cap, advisories * 30), cap), eventCompleteness: categoryWithCap(Math.min(cap, highConfidenceEvents * 18), cap), sourceCount, advisories, events: relevantEvents.length, highConfidenceEvents, capped: cap < 100, gaps };
  });
}

function confidenceAssessment(coverage: ProviderCoverageItem[], counts: Awaited<ReturnType<typeof tableCounts>>, gate: EvidenceGate) {
  const liveSources = coverage.filter((item) => item.active && !item.fallback).length;
  const officialSources = coverage.filter((item) => item.active && OFFICIAL_PROVIDER_PATTERNS.test(item.name)).length;
  const fallbackSources = coverage.filter((item) => item.fallback).length;
  const staleSources = coverage.filter((item) => item.stale).length;
  const missingOfficialAdvisories = ['uk-fcdo', 'us-state', 'canada-advisories', 'smartraveller'].filter((key) => !coverage.find((item) => item.key === key)?.configured).length;

  return {
    reportConfidence: scoreConfidence({ officialSources, liveSources, fallbackSources, staleSources, missingCriticalFeeds: missingOfficialAdvisories, evidenceGate: gate, domainGaps: counts.advisories === 0 ? ['No persisted advisory records available for report evidence.'] : [] }),
    routeConfidence: scoreConfidence({ officialSources, liveSources, fallbackSources, staleSources, missingCriticalFeeds: 0, evidenceGate: gate, domainGaps: counts.routeSegments === 0 ? ['No persisted route segment assessments found; route confidence depends on itinerary text only.'] : [] }),
    hotelConfidence: scoreConfidence({ officialSources: 0, liveSources: counts.hotelCandidates > 0 ? 1 : 0, fallbackSources, staleSources, missingCriticalFeeds: counts.hotelCandidates > 0 ? 0 : 2, evidenceGate: { ...gate, eventRelevanceHigh: false }, domainGaps: ['Hotel data must be treated as public-map candidate or manual-review evidence until analyst validation exists.'] }),
    healthConfidence: scoreConfidence({ officialSources, liveSources, fallbackSources, staleSources, missingCriticalFeeds: coverage.find((item) => item.key === 'health-outbreaks')?.configured ? 0 : 1, evidenceGate: gate, domainGaps: counts.riskEvents === 0 ? ['No health/disaster event records available for destination correlation.'] : [] }),
    operationalConfidence: scoreConfidence({ officialSources, liveSources, fallbackSources, staleSources, missingCriticalFeeds: missingOfficialAdvisories, evidenceGate: gate, domainGaps: ['Operational recommendations require analyst approval for close protection, medical evacuation and secure transport decisions.'] })
  };
}

function adminReviewRecommendations() {
  return [
    { area: 'Analyst review', recommendation: 'Queue low-confidence country briefs, hotel candidates and route assessments for analyst review before client release.', futureStructure: 'analyst_review_queue' },
    { area: 'Evidence approval', recommendation: 'Track source evidence approval separately from ingestion status so provider records are not automatically treated as verified.', futureStructure: 'evidence_approvals' },
    { area: 'Route approval', recommendation: 'Allow analysts to approve, amend or reject route controls for executive/high-risk itineraries.', futureStructure: 'route_approvals' },
    { area: 'Hotel approval', recommendation: 'Distinguish verified hotel recommendations, public-map candidates and manually validated hotels.', futureStructure: 'hotel_validation_status' },
    { area: 'Source override', recommendation: 'Permit senior analysts to override stale or conflicting source confidence with auditable rationale.', futureStructure: 'source_confidence_overrides' }
  ];
}

export async function generateProviderCoverageAudit(): Promise<ProviderCoverageAudit> {
  const [freshness, counts, countryData, eventData] = await Promise.all([freshnessRows(), tableCounts(), countryRows(), eventRows()]);
  const coverage = providerCoverage(freshness);
  const missing = missingFeeds(coverage);
  const eventsByCountry = new Map<string, EventCoverageRow[]>();
  for (const event of eventData) {
    const iso = event.country_iso2 ?? '';
    if (!iso) continue;
    const list = eventsByCountry.get(iso) ?? [];
    list.push(event);
    eventsByCountry.set(iso, list);
  }
  const allRelevantEvents = eventData.filter((event) => scoreEventRelevance(event, event.country_iso2 ?? undefined).relevanceScore >= 55);
  const gate = evidenceGate(coverage, allRelevantEvents.length >= Math.max(2, eventData.length * 0.15));
  return {
    generatedAt: new Date().toISOString(),
    providerCoverage: coverage,
    missingFeeds: missing,
    fallbackUsage: coverage.filter((item) => item.fallback).map((item) => ({ provider: item.name, reason: item.notes })),
    staleSources: coverage.filter((item) => item.stale).map((item) => ({ provider: item.name, lastRun: item.lastRun, reason: item.lastRun ? 'Last successful run is older than seven days.' : 'No successful run recorded.' })),
    countryCoverage: countryCoverage(countryData, eventsByCountry, gate),
    confidenceAssessment: confidenceAssessment(coverage, counts, gate),
    recommendedNextFeeds: recommendedNextFeeds(),
    adminReviewRecommendations: adminReviewRecommendations()
  };
}

export const confidenceCategory = category;
export const calculateSourceConfidence = scoreConfidence;
