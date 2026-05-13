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
  rawPayload?: unknown;
  raw_payload?: unknown;
};

export type EventRelevanceScore = {
  relevanceScore: number;
  sourceTrust: number;
  geoConfidence: number;
  freshnessWeight: number;
  operationalImpact: number;
  reasons: string[];
};

const OFFICIAL_SOURCE = /(fcdo|state department|smartraveller|canada|mfat|gdacs|usgs|who|cdc|official|government)/i;
const LOW_TRUST_SOURCE = /(gdelt|rss|news|blog|social)/i;
const FALLBACK_TEXT = /(demo fallback|fallback active|provider status|adapter pending)/i;

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

export function geoConfidenceFor(event: EventEvidenceLike, targetCountryIso2?: string, targetCity?: string) {
  const country = countryOf(event).toLowerCase();
  const city = cityOf(event).toLowerCase();
  const targetCountry = text(targetCountryIso2).toLowerCase();
  const targetCityLower = text(targetCity).toLowerCase();
  if (targetCityLower && city && city === targetCityLower) return 1;
  if (targetCountry && country && country === targetCountry) return 0.9;
  if (!targetCountry && country) return 0.5;
  if (!country && !city) return 0.12;
  return 0.18;
}

export function operationalImpactFor(event: EventEvidenceLike) {
  const combined = lower(`${event.title ?? ''} ${event.summary ?? ''} ${event.category ?? ''}`);
  let impact = severityWeightFor(text(event.severity));
  if (/(airport|aviation|border|strike|road|transport|curfew|attack|terror|kidnap|evacuat|protest|unrest|flood|earthquake|outbreak|disease)/.test(combined)) impact += 0.18;
  if (/(opinion|analysis|market|sports|finance)/.test(combined)) impact -= 0.22;
  return Math.max(0.1, Math.min(1, impact));
}

export function scoreEventRelevance(event: EventEvidenceLike, targetCountryIso2?: string, targetCity?: string): EventRelevanceScore {
  const reasons: string[] = [];
  if (isFallbackEvent(event)) return { relevanceScore: 0, sourceTrust: 0, geoConfidence: 0, freshnessWeight: 0, operationalImpact: 0, reasons: ['Fallback/provider-status records are not operational evidence.'] };
  const sourceTrust = sourceTrustFor(text(event.source ?? event.provider));
  const geoConfidence = geoConfidenceFor(event, targetCountryIso2, targetCity);
  const freshnessWeight = freshnessWeightFor(eventDate(event));
  const operationalImpact = operationalImpactFor(event);
  if (sourceTrust >= 0.8) reasons.push('Official or public authority source.');
  if (sourceTrust <= 0.45) reasons.push('Low-trust/noisy source; reduced influence.');
  if (geoConfidence < 0.55) reasons.push('Weak destination relevance.');
  if (freshnessWeight < 0.5) reasons.push('Stale event; influence capped.');
  const noisySourceCap = LOW_TRUST_SOURCE.test(text(event.source ?? event.provider)) ? 0.72 : 1;
  const score = Math.round(100 * sourceTrust * geoConfidence * freshnessWeight * operationalImpact * noisySourceCap);
  return { relevanceScore: Math.max(0, Math.min(100, score)), sourceTrust, geoConfidence, freshnessWeight, operationalImpact, reasons };
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

export function filterRelevantEvents<T extends EventEvidenceLike>(events: T[], targetCountryIso2?: string, targetCity?: string, threshold = 45): Array<T & { relevance: EventRelevanceScore }> {
  return dedupeEvents(events)
    .map((event) => ({ ...event, relevance: scoreEventRelevance(event, targetCountryIso2, targetCity) }))
    .filter((event) => event.relevance.relevanceScore >= threshold)
    .sort((a, b) => b.relevance.relevanceScore - a.relevance.relevanceScore);
}

export function filterRelevantAlerts(events: Alert[], targetCountryIso2?: string, targetCity?: string, threshold = 45): Alert[] {
  return filterRelevantEvents(events as unknown as EventEvidenceLike[], targetCountryIso2, targetCity, threshold).map(({ relevance: _relevance, ...event }) => event as unknown as Alert);
}

export function filterRelevantProviderItems(items: ProviderItem[], targetCountryIso2?: string, threshold = 45): ProviderItem[] {
  return filterRelevantEvents(items as unknown as EventEvidenceLike[], targetCountryIso2, undefined, threshold).map(({ relevance: _relevance, ...item }) => item as unknown as ProviderItem);
}
