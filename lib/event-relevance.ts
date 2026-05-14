import type { Alert } from './types';
import type { ProviderItem } from './providers/shared';

export type EventEvidenceLike = {
  id?: string;
  title?: string;
  country?: string;
  countryIso2?: string | null;
  country_iso2?: string | null;
  city?: string | null;
  city_name?: string | null;
  category?: string;
  severity?: string | null;
  source?: string;
  provider?: string;
  timestamp?: string;
  event_time?: string | null;
  occurred_at?: string | null;
  publishedAt?: string;
  published_at?: string | null;
  summary?: string;
  sourceStatus?: string;
  source_status?: string | null;
  status?: string | null;
  confidence?: string | null;
  geoMatchType?: GeoMatchType;
  geoDistanceKm?: number | null;
  countryMatch?: boolean;
  cityMatch?: boolean;
  routeMatch?: boolean;
  operationalRelevance?: boolean;
  affectsScoring?: boolean;
  relevanceScore?: number;
  exclusionReason?: string;
  rawPayload?: unknown;
  raw_payload?: unknown;
};

export type GeoMatchType = 'city' | 'country' | 'regional' | 'global' | 'unknown';

export type EventRelevanceScore = {
  geoMatchType: GeoMatchType;
  geoDistanceKm: number | null;
  countryMatch: boolean;
  cityMatch: boolean;
  routeMatch: boolean;
  operationalRelevance: boolean;
  affectsScoring: boolean;
  relevanceScore: number;
  sourceTrust: number;
  geoConfidence: number;
  freshnessWeight: number;
  operationalImpact: number;
  exclusionReason?: string;
  reasons: string[];
};

const OFFICIAL_SOURCE = /(fcdo|state department|smartraveller|canada|mfat|gdacs|usgs|who|cdc|official|government)/i;
const LOW_TRUST_SOURCE = /(gdelt|rss|news|blog|social)/i;
const FALLBACK_TEXT = /(demo fallback|fallback active|provider status|adapter pending)/i;
const GLOBAL_TEXT = /\b(global|worldwide|international|multiple countries|multi-country|global alert|planetary)\b/i;
const NATURAL_GLOBAL_TEXT = /\b(earthquake|quake|seismic|weather|storm|hurricane|typhoon|cyclone|flood|volcano|tsunami|wildfire)\b/i;
const REGION_BY_COUNTRY: Record<string, string[]> = {
  GB: ['europe', 'western europe', 'united kingdom region', 'british isles'],
  FR: ['europe', 'western europe', 'schengen', 'eu'],
  KE: ['africa', 'east africa', 'horn of africa'],
  UA: ['europe', 'eastern europe'],
  JP: ['asia', 'east asia', 'pacific']
};
const COUNTRY_ALIASES: Record<string, string[]> = {
  GB: ['gb', 'gbr', 'uk', 'united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland'],
  US: ['us', 'usa', 'united states', 'united states of america', 'america'],
  KE: ['ke', 'ken', 'kenya'],
  FR: ['fr', 'fra', 'france'],
  UA: ['ua', 'ukr', 'ukraine'],
  JP: ['jp', 'jpn', 'japan']
};
const US_STATES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida', 'georgia',
  'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine', 'maryland',
  'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska', 'nevada', 'new hampshire',
  'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio', 'oklahoma', 'oregon', 'pennsylvania',
  'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas', 'utah', 'vermont', 'virginia', 'washington',
  'west virginia', 'wisconsin', 'wyoming', 'district of columbia'
];

type RelevanceTarget = {
  countryIso2?: string;
  city?: string;
  routeText?: string;
};

function text(value: unknown) {
  return String(value ?? '').trim();
}

function lower(value: unknown) {
  return text(value).toLowerCase();
}

function eventDate(event: EventEvidenceLike) {
  return text(event.timestamp ?? event.event_time ?? event.occurred_at ?? event.publishedAt ?? event.published_at);
}

function countryOf(event: EventEvidenceLike) {
  return text(event.countryIso2 ?? event.country_iso2 ?? event.country);
}

function cityOf(event: EventEvidenceLike) {
  return text(event.city ?? event.city_name);
}

function canonicalCountry(value?: string) {
  const lowerValue = lower(value);
  if (!lowerValue) return '';
  const direct = Object.entries(COUNTRY_ALIASES).find(([iso, aliases]) => iso.toLowerCase() === lowerValue || aliases.includes(lowerValue));
  return direct?.[0] ?? lowerValue.toUpperCase();
}

function combinedText(event: EventEvidenceLike) {
  return lower(`${event.title ?? ''} ${event.country ?? ''} ${event.countryIso2 ?? ''} ${event.country_iso2 ?? ''} ${event.city ?? ''} ${event.city_name ?? ''} ${event.summary ?? ''} ${event.category ?? ''} ${event.source ?? ''} ${event.provider ?? ''}`);
}

function containsAlias(haystack: string, iso?: string) {
  const canonical = canonicalCountry(iso);
  if (!canonical) return false;
  const aliases = COUNTRY_ALIASES[canonical] ?? [canonical.toLowerCase()];
  return aliases.some((alias) => new RegExp(`\\b${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(haystack));
}

function mentionedUsState(value: string) {
  return US_STATES.find((state) => new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(value));
}

function isHighSeverity(event: EventEvidenceLike) {
  return /^(high|critical)$/i.test(text(event.severity));
}

function isKeywordOnlySource(event: EventEvidenceLike) {
  const source = text(event.source ?? event.provider);
  return LOW_TRUST_SOURCE.test(source) && !countryOf(event) && !cityOf(event);
}

function classifyGeoMatch(event: EventEvidenceLike, target: RelevanceTarget) {
  const targetCountry = canonicalCountry(target.countryIso2);
  const eventCountry = canonicalCountry(countryOf(event));
  const eventCity = cityOf(event).toLowerCase();
  const targetCity = text(target.city).toLowerCase();
  const eventText = combinedText(event);
  const routeText = lower(target.routeText);
  const cityMatch = Boolean(targetCity && eventCity && eventCity === targetCity);
  const countryMatch = Boolean(targetCountry && ((eventCountry && eventCountry === targetCountry) || containsAlias(eventText, targetCountry)));
  const routeMatch = Boolean(routeText && (containsAlias(routeText, eventCountry) || (eventCity && routeText.includes(eventCity)) || (mentionedUsState(eventText) && routeText.includes(mentionedUsState(eventText) ?? ''))));
  const regional = Boolean(targetCountry && (REGION_BY_COUNTRY[targetCountry] ?? []).some((region) => eventText.includes(region)));
  const global = GLOBAL_TEXT.test(eventText) || (/^(global|worldwide|international)$/i.test(countryOf(event)));

  let geoMatchType: GeoMatchType = 'unknown';
  if (cityMatch) geoMatchType = 'city';
  else if (countryMatch) geoMatchType = 'country';
  else if (routeMatch) geoMatchType = 'city';
  else if (regional) geoMatchType = 'regional';
  else if (global) geoMatchType = 'global';

  return { geoMatchType, countryMatch, cityMatch, routeMatch, regional, global };
}

function exclusionReasonFor(event: EventEvidenceLike, target: RelevanceTarget, geo: ReturnType<typeof classifyGeoMatch>) {
  const eventText = combinedText(event);
  const source = text(event.source ?? event.provider);
  const targetCountry = canonicalCountry(target.countryIso2);
  const eventCountry = canonicalCountry(countryOf(event));
  const usState = mentionedUsState(eventText);

  if (isFallbackEvent(event)) return 'Fallback or demo provider records are not operational evidence.';
  if (targetCountry && usState && targetCountry !== 'US' && !geo.routeMatch) return `Unrelated US state (${usState}) for non-US destination.`;
  if (targetCountry && eventCountry && eventCountry !== targetCountry && !geo.routeMatch && !geo.regional) return 'Event country does not match destination or route.';
  if (geo.geoMatchType === 'global') return 'Global events cannot affect scoring without destination geography.';
  if (geo.geoMatchType === 'unknown') return 'No country, city, route, or accepted regional match.';
  if (NATURAL_GLOBAL_TEXT.test(eventText) && !geo.cityMatch && !geo.countryMatch && !geo.routeMatch && !geo.regional) return 'Global weather or natural hazard is not geographically matched.';
  if (isKeywordOnlySource(event)) return 'RSS/GDELT/news keyword-only match with no country or city evidence.';
  if (LOW_TRUST_SOURCE.test(source) && !geo.countryMatch && !geo.cityMatch && !geo.routeMatch) return 'Noisy public/news source without direct geography.';
  if (!isHighSeverity(event)) return 'Only high-severity city, country, route, or regional events may affect scoring.';
  return undefined;
}

export function isFallbackEvent(event: EventEvidenceLike) {
  const status = lower(event.status ?? event.sourceStatus ?? event.source_status);
  const combined = lower(`${event.title ?? ''} ${event.source ?? ''} ${event.provider ?? ''} ${event.category ?? ''}`);
  return status.includes('demo') || status.includes('fallback') || FALLBACK_TEXT.test(combined);
}

export function sourceTrustFor(source = '') {
  if (!source) return 0.25;
  if (OFFICIAL_SOURCE.test(source)) return 0.9;
  if (/rest countries|world bank|un data/i.test(source)) return 0.8;
  if (LOW_TRUST_SOURCE.test(source)) return 0.45;
  return 0.6;
}

export function severityWeightFor(severity = '') {
  if (/critical/i.test(severity)) return 1;
  if (/high/i.test(severity)) return 0.8;
  if (/moderate/i.test(severity)) return 0.55;
  if (/low/i.test(severity)) return 0.28;
  return 0.35;
}

export function freshnessWeightFor(value = '') {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return 0.25;
  const ageHours = (Date.now() - time) / (1000 * 60 * 60);
  if (ageHours <= 72) return 1;
  if (ageHours <= 24 * 7) return 0.75;
  if (ageHours <= 24 * 30) return 0.45;
  return 0.18;
}

export function geoConfidenceFor(event: EventEvidenceLike, targetCountryIso2?: string, targetCity?: string, routeText?: string) {
  const geo = classifyGeoMatch(event, { countryIso2: targetCountryIso2, city: targetCity, routeText });
  if (geo.cityMatch) return 1;
  if (geo.routeMatch) return 0.95;
  if (geo.countryMatch) return 0.9;
  if (geo.regional) return 0.58;
  if (geo.global) return 0;
  return 0;
}

export function operationalImpactFor(event: EventEvidenceLike) {
  const combined = lower(`${event.title ?? ''} ${event.summary ?? ''} ${event.category ?? ''}`);
  let impact = severityWeightFor(text(event.severity));
  if (/(airport|aviation|border|strike|road|transport|curfew|attack|terror|kidnap|evacuat|protest|unrest|flood|earthquake|outbreak|disease)/.test(combined)) impact += 0.18;
  if (/(opinion|analysis|market|sports|finance)/.test(combined)) impact -= 0.22;
  return Math.max(0.1, Math.min(1, impact));
}

export function scoreEventRelevance(event: EventEvidenceLike, targetCountryIso2?: string, targetCity?: string, routeText?: string): EventRelevanceScore {
  const reasons: string[] = [];
  const geo = classifyGeoMatch(event, { countryIso2: targetCountryIso2, city: targetCity, routeText });
  const exclusionReason = exclusionReasonFor(event, { countryIso2: targetCountryIso2, city: targetCity, routeText }, geo);
  if (exclusionReason) {
    return {
      geoMatchType: geo.geoMatchType,
      geoDistanceKm: null,
      countryMatch: geo.countryMatch,
      cityMatch: geo.cityMatch,
      routeMatch: geo.routeMatch,
      operationalRelevance: false,
      affectsScoring: false,
      relevanceScore: 0,
      sourceTrust: isFallbackEvent(event) ? 0 : sourceTrustFor(text(event.source ?? event.provider)),
      geoConfidence: geoConfidenceFor(event, targetCountryIso2, targetCity, routeText),
      freshnessWeight: isFallbackEvent(event) ? 0 : freshnessWeightFor(eventDate(event)),
      operationalImpact: isFallbackEvent(event) ? 0 : operationalImpactFor(event),
      exclusionReason,
      reasons: [exclusionReason]
    };
  }
  const sourceTrust = sourceTrustFor(text(event.source ?? event.provider));
  const geoConfidence = geoConfidenceFor(event, targetCountryIso2, targetCity, routeText);
  const freshnessWeight = freshnessWeightFor(eventDate(event));
  const operationalImpact = operationalImpactFor(event);
  if (sourceTrust >= 0.8) reasons.push('Official or public authority source.');
  if (sourceTrust <= 0.45) reasons.push('Low-trust/noisy source; reduced influence.');
  if (geoConfidence < 0.55) reasons.push('Weak destination relevance.');
  if (freshnessWeight < 0.5) reasons.push('Stale event; influence capped.');
  const noisySourceCap = LOW_TRUST_SOURCE.test(text(event.source ?? event.provider)) ? 0.72 : 1;
  const score = Math.round(100 * sourceTrust * geoConfidence * freshnessWeight * operationalImpact * noisySourceCap);
  const relevanceScore = Math.max(0, Math.min(100, score));
  const operationalRelevance = relevanceScore >= 45;
  const affectsScoring = operationalRelevance && isHighSeverity(event) && ['city', 'country', 'regional'].includes(geo.geoMatchType);
  return {
    geoMatchType: geo.routeMatch ? 'city' : geo.geoMatchType,
    geoDistanceKm: null,
    countryMatch: geo.countryMatch,
    cityMatch: geo.cityMatch,
    routeMatch: geo.routeMatch,
    operationalRelevance,
    affectsScoring,
    relevanceScore,
    sourceTrust,
    geoConfidence,
    freshnessWeight,
    operationalImpact,
    exclusionReason: affectsScoring ? undefined : 'Only high-severity city, country, route, or regional events may affect scoring.',
    reasons
  };
}

export function annotateEventRelevance<T extends EventEvidenceLike>(event: T, targetCountryIso2?: string, targetCity?: string, routeText?: string): T & EventRelevanceScore {
  const relevance = scoreEventRelevance(event, targetCountryIso2, targetCity, routeText);
  return { ...event, ...relevance };
}

export function dedupeEvents<T extends EventEvidenceLike>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [lower(event.source ?? event.provider), lower(event.title), countryOf(event).toLowerCase(), cityOf(event).toLowerCase(), eventDate(event).slice(0, 10)].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterRelevantEvents<T extends EventEvidenceLike>(events: T[], targetCountryIso2?: string, targetCity?: string, threshold = 45, routeText?: string): Array<T & { relevance: EventRelevanceScore }> {
  return dedupeEvents(events)
    .map((event) => ({ ...event, relevance: scoreEventRelevance(event, targetCountryIso2, targetCity, routeText) }))
    .filter((event) => event.relevance.operationalRelevance && event.relevance.relevanceScore >= threshold)
    .sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore);
}

export function filterScoringEvents<T extends EventEvidenceLike>(events: T[], targetCountryIso2?: string, targetCity?: string, threshold = 45, routeText?: string): Array<T & { relevance: EventRelevanceScore }> {
  return filterRelevantEvents(events, targetCountryIso2, targetCity, threshold, routeText).filter((event) => event.relevance.affectsScoring);
}

export function countExcludedGlobalEvents(events: EventEvidenceLike[], targetCountryIso2?: string, targetCity?: string, routeText?: string) {
  return events.reduce((total, event) => {
    const relevance = scoreEventRelevance(event, targetCountryIso2, targetCity, routeText);
    return total + (!relevance.affectsScoring && ['global', 'unknown'].includes(relevance.geoMatchType) ? 1 : 0);
  }, 0);
}

export function filterRelevantAlerts(events: Alert[], targetCountryIso2?: string, targetCity?: string, threshold = 45, routeText?: string): Alert[] {
  return filterRelevantEvents(events as unknown as EventEvidenceLike[], targetCountryIso2, targetCity, threshold, routeText).map(({ relevance: _relevance, ...event }) => event as unknown as Alert);
}

export function filterRelevantProviderItems(items: ProviderItem[], targetCountryIso2?: string, threshold = 45): ProviderItem[] {
  return filterRelevantEvents(items as unknown as EventEvidenceLike[], targetCountryIso2, undefined, threshold).map(({ relevance: _relevance, ...item }) => item as unknown as ProviderItem);
}
