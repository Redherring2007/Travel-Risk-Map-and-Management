import type { Alert, Trip, TripReport } from './types';
import type { SourceSummaryItem } from './source-data';
import type { TripAssessmentRecord } from './trip-assessment';
import { countExcludedGlobalEvents, filterRelevantAlerts } from './event-relevance';

const MISSING = 'Limited verified data available';
const MANUAL = 'Manual verification required';

type UnknownRecord = Record<string, unknown>;

export type VisualReportBadge = {
  label: string;
  value: string;
  tone?: 'low' | 'moderate' | 'high' | 'critical' | 'neutral';
};

export type VisualReportListItem = {
  title: string;
  detail: string;
  meta?: string;
  level?: string;
  source?: string;
};

export type VisualReportMissingGroup = {
  category: string;
  missingItems: string[];
  whyItMatters: string;
  whatToAdd: string;
  confidenceImpact: string;
};

export type VisualReportRouteSegment = {
  segmentName: string;
  from: string;
  to: string;
  level: string;
  score: string;
  mitigation: string;
  confidence: string;
};

export type VisualReportHotel = {
  name: string;
  level: string;
  score: string;
  strengths: string[];
  concerns: string[];
  note: string;
};

export type VisualReportRiskBar = {
  label: string;
  score: number;
  level: string;
  rationale: string;
};

export type VisualReportNarrative = {
  executivePosition: string;
  principalJudgement: string;
  operationalImpact: string;
  requiredControlsSummary: string;
  confidenceNarrative: string;
  finalRationale: string;
  source: 'deterministic' | 'ai-assisted';
};

export type VisualReportModel = {
  reportMeta: {
    reportId: string;
    title: string;
    generatedAt: string;
    validUntil: string;
  };
  executiveSnapshot: {
    destination: string;
    summary: string;
    recommendation: string;
    advisory: string;
    keyIssue: string;
    keyReason: string;
    summarySource: 'ai-assisted' | 'deterministic' | 'report';
  };
  riskAtGlance: {
    overallScore: number | null;
    overallLevel: string;
    threatRating: string;
    confidenceRating: string;
    dataQualityRating: string;
    excludedGlobalEventsCount: number;
    manualReviewRequirements: string[];
    confidence: string;
    badges: VisualReportBadge[];
    keyDrivers: VisualReportListItem[];
    bars: VisualReportRiskBar[];
  };
  narrative: VisualReportNarrative;
  tripOverview: VisualReportBadge[];
  routeAndMovement: {
    segments: VisualReportRouteSegment[];
    note: string;
  };
  accommodationSafety: {
    hotels: VisualReportHotel[];
    note: string;
  };
  healthAndMedical: VisualReportListItem[];
  emergencyAndConsular: VisualReportListItem[];
  advisories: VisualReportListItem[];
  latestEvents: VisualReportListItem[];
  intelligenceGaps: VisualReportListItem[];
  missingDataGroups: VisualReportMissingGroup[];
  mitigationPlan: VisualReportListItem[];
  dataDepth: {
    officialAdvisories: VisualReportListItem[];
    countryIndicators: VisualReportListItem[];
    healthMedicalContext: VisualReportListItem[];
    routeMovementControls: VisualReportListItem[];
    hotelSafetyStatus: VisualReportListItem[];
    sourceConfidence: VisualReportListItem[];
  };
  dataQuality: {
    liveSourcesCount: number;
    fallbackOrMissingSourcesCount: number;
    latestSourceDate: string;
    overallDataConfidence: string;
    missingCriticalDataCount: number;
    recommendedNextInputs: string[];
  };
  goNoGo: {
    recommendation: string;
    rationale: string;
  };
  sourceSummary: VisualReportListItem[];
};

export function applyAiExecutiveSummary(model: VisualReportModel, summary: string): VisualReportModel {
  const clean = sentenceLimit(cleanReportText(summary), 5);
  if (!clean || isUnavailableText(clean)) return model;
  return {
    ...model,
    executiveSnapshot: {
      ...model.executiveSnapshot,
      summary: clean,
      summarySource: 'ai-assisted'
    }
  };
}

export function applyAiVisualNarratives(model: VisualReportModel, text: string): VisualReportModel {
  try {
    const parsed = JSON.parse(text) as Partial<VisualReportNarrative>;
    const next = {
      executivePosition: sentenceLimit(cleanReportText(parsed.executivePosition), 6),
      principalJudgement: wordLimit(cleanReportText(parsed.principalJudgement), 120),
      operationalImpact: wordLimit(cleanReportText(parsed.operationalImpact), 120),
      requiredControlsSummary: wordLimit(cleanReportText(parsed.requiredControlsSummary), 120),
      confidenceNarrative: wordLimit(cleanReportText(parsed.confidenceNarrative), 120),
      finalRationale: wordLimit(cleanReportText(parsed.finalRationale), 120)
    };
    if (Object.values(next).some((value) => !value || isUnavailableText(value))) return model;
    return { ...model, narrative: { ...next, source: 'ai-assisted' }, executiveSnapshot: { ...model.executiveSnapshot, summary: next.executivePosition, summarySource: 'ai-assisted' } };
  } catch {
    return model;
  }
}

export function stripRawSymbols(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return '';
  return String(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[{}[\]"]/g, ' ')
    .replace(/\b(null|undefined|NaN)\b/g, ' ')
    .replace(/\s*[,:]\s*(?=\s*[,:])/g, ' ');
}

export function cleanMarkdownText(value: unknown): string {
  return stripRawSymbols(value)
    .replace(/\s*\|\s*/g, ' | ')
    .replace(/_{2,}/g, ' ')
    .replace(/-{3,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanReportText(value: unknown, fallback = ''): string {
  const cleaned = cleanMarkdownText(value)
    .replace(/\b(raw_payload|jsonb|source_summary|key_drivers|route_risks|itinerary_risks)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export function compactList<T>(items: T[] | undefined | null, limit: number): T[] {
  return Array.isArray(items) ? items.filter(Boolean).slice(0, limit) : [];
}

export function safeText(value: unknown, fallback = MISSING): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const cleaned = cleanReportText(value);
    return cleaned || fallback;
  }
  return fallback;
}

export function limitList<T>(items: T[] | undefined | null, limit: number): T[] {
  return compactList(items, limit);
}

export function dedupeByTitleOrSource<T extends UnknownRecord>(items: T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = safeText(item.title ?? item.source ?? item.name ?? item.id ?? JSON.stringify(item).slice(0, 120), '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function removeFallbackStatusItems<T extends UnknownRecord>(items: T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    const status = safeText(item.status ?? item.sourceStatus ?? item.source_status, '').toLowerCase();
    const title = safeText(item.title ?? item.source ?? item.name, '').toLowerCase();
    const source = safeText(item.source ?? item.provider, '').toLowerCase();
    return !status.includes('demo') && !status.includes('fallback') && !title.includes('demo fallback') && !title.includes('provider status') && !source.includes('demo fallback');
  });
}

function asRecord(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringArray(value: unknown): string[] {
  return asArray(value).map((item) => safeText(item, '')).filter(Boolean);
}

function firstText(values: unknown[], fallback = MISSING): string {
  for (const value of values) {
    const text = safeText(value, '');
    if (text) return text;
  }
  return fallback;
}

function extractMarkdownSection(markdown: string, headings: string[], fallback = MISSING): string {
  const lines = markdown.split(/\r?\n/);
  const headingSet = headings.map((heading) => heading.toLowerCase());
  let collecting = false;
  const collected: string[] = [];
  for (const line of lines) {
    const normalised = line.replace(/^#+\s*/, '').trim().toLowerCase();
    const isHeading = /^#{1,4}\s+/.test(line);
    if (isHeading && collecting) break;
    if (isHeading && headingSet.some((heading) => normalised.includes(heading))) {
      collecting = true;
      continue;
    }
    if (collecting) collected.push(line.replace(/^[-*]\s*/, '').trim());
  }
  return sentenceLimit(safeText(collected.filter(Boolean).join(' '), fallback), 5);
}

function riskTone(level: string): VisualReportBadge['tone'] {
  const lower = level.toLowerCase();
  if (lower.includes('critical') || lower.includes('avoid')) return 'critical';
  if (lower.includes('high') || lower.includes('caution')) return 'high';
  if (lower.includes('moderate')) return 'moderate';
  if (lower.includes('low') || lower.includes('go')) return 'low';
  return 'neutral';
}

function levelFromScore(score: unknown): string {
  const value = Number(score);
  if (!Number.isFinite(value)) return MISSING;
  if (value >= 75) return 'Critical';
  if (value >= 50) return 'High';
  if (value >= 25) return 'Moderate';
  return 'Low';
}

function alertItems(items: Alert[] | undefined, limit: number, countryIso2?: string, cityName?: string, routeText?: string): VisualReportListItem[] {
  const nonFallback = removeFallbackStatusItems(dedupeByTitleOrSource((items ?? []) as unknown as UnknownRecord[])) as unknown as Alert[];
  const relevant = filterRelevantAlerts(nonFallback, countryIso2, cityName, 45, routeText);
  const cleaned = limitList(relevant, limit);
  return cleaned.map((item) => ({
    title: safeText(item.title),
    detail: safeText(item.summary),
    meta: [item.country, item.city, shortDate(item.timestamp)].filter(Boolean).join(' | '),
    level: item.severity,
    source: item.source
  }));
}

function sourceItems(items: SourceSummaryItem[] | undefined, limit = 8): VisualReportListItem[] {
  const cleaned = limitList(removeFallbackStatusItems(dedupeByTitleOrSource((items ?? []) as unknown as UnknownRecord[])), limit) as unknown as SourceSummaryItem[];
  return cleaned.map((item) => ({
    title: safeText(item.source),
    detail: `${safeText(item.status, 'Status unavailable')} | ${safeText(item.confidence, 'Confidence unavailable')}`,
    meta: item.lastUpdated ? `Last updated ${shortDate(item.lastUpdated)}` : MISSING,
    source: item.records === undefined ? undefined : `${item.records} records`
  }));
}

function listItems(values: unknown[], limit: number, fallbackTitle: string): VisualReportListItem[] {
  const items = limitList(values, limit).map((item, index) => {
    const record = asRecord(item);
    const title = firstText([record.title, record.name, record.segmentName, record.segment_name, `Item ${index + 1}`], fallbackTitle);
    const detail = firstText([record.detail, record.summary, record.mitigation, record.recommendation, record.note, item], MISSING);
    return { title, detail, level: safeText(record.level, ''), source: safeText(record.source, '') };
  });
  return items.length ? items : [{ title: fallbackTitle, detail: MISSING }];
}

function isUnavailableText(value: string): boolean {
  const lower = value.toLowerCase();
  return !value || lower.includes('limited verified data') || lower.includes('manual verification') || lower.includes('not supplied') || lower.includes('unavailable');
}

function sentenceLimit(value: string, maxSentences = 5): string {
  const sentences = cleanReportText(value).split(/(?<=[.!?])\s+/).map((item) => item.trim()).filter(Boolean);
  return safeText(sentences.slice(0, maxSentences).join(' '), value);
}

function wordLimit(value: string, maxWords = 120): string {
  const words = cleanReportText(value).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(' ');
}

function shortDate(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? safeText(value, '') : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function deterministicExecutiveSummary(input: {
  destination: string;
  score: number | null;
  level: string;
  recommendation: string;
  confidence: string;
  keyDrivers: VisualReportListItem[];
  travellerProfile: string;
  missingItems: string[];
}) {
  const scoreText = input.score === null ? 'an unscored risk position' : `${input.level} risk (${input.score}/100)`;
  const driver = input.keyDrivers.find((item) => !isUnavailableText(item.detail))?.detail ?? 'limited verified destination intelligence';
  const missing = input.missingItems.length ? ` Confidence is constrained by missing inputs: ${input.missingItems.slice(0, 3).join(', ')}.` : '';
  return `${input.destination} is assessed at ${scoreText}, with a ${input.recommendation} recommendation for the current itinerary. The principal reason for the rating is ${driver}. Traveller exposure is assessed against the ${input.travellerProfile} profile and the submitted route, accommodation and document data. Overall data confidence is ${input.confidence}.${missing}`;
}

function narrativeBlock(input: {
  destination: string;
  score: number | null;
  level: string;
  recommendation: string;
  confidence: string;
  keyDrivers: VisualReportListItem[];
  missingItems: string[];
  routes: VisualReportRouteSegment[];
  hotels: VisualReportHotel[];
  advisory: string;
}): VisualReportNarrative {
  const scoreText = input.score === null ? 'an unscored position' : `${input.level} (${input.score}/100)`;
  const principal = input.keyDrivers.find((item) => !isUnavailableText(item.detail)) ?? input.keyDrivers[0];
  const principalText = principal ? `${principal.title}: ${principal.detail}` : 'Limited verified data is available for the destination.';
  const routeText = input.routes.length
    ? `Route exposure is driven by ${input.routes.slice(0, 2).map((route) => `${route.segmentName.toLowerCase()} assessed as ${route.level}`).join(' and ')}.`
    : 'Route exposure cannot be fully assessed because movement details are incomplete.';
  const hotelText = input.hotels.length
    ? 'Accommodation data is limited to public-map candidates and requires manual verification before it is treated as a recommendation.'
    : 'No verified hotel recommendation is available from current free sources.';
  const missingText = input.missingItems.length
    ? `Critical missing inputs include ${input.missingItems.slice(0, 4).join(', ')}.`
    : 'No material missing trip inputs were identified from the supplied record.';
  return {
    executivePosition: sentenceLimit(`${input.destination} is assessed as ${scoreText} with a ${input.recommendation} recommendation. ${principalText}. ${routeText} ${hotelText} ${missingText}`, 6),
    principalJudgement: wordLimit(`The principal judgement is that ${principalText}. This judgement should be read alongside the current advisory position: ${input.advisory}.`, 120),
    operationalImpact: wordLimit(`${routeText} Traveller movement, accommodation selection and incident-response planning should be managed against the stated confidence level of ${input.confidence}.`, 120),
    requiredControlsSummary: wordLimit(`Priority controls are vetted movement planning, confirmation of accommodation, document readiness checks, medical and insurance validation, and escalation contacts before departure. ${missingText}`, 120),
    confidenceNarrative: wordLimit(`Confidence is ${input.confidence}. The assessment distinguishes confirmed structured data from inferred assessment, and any missing or fallback-dependent data should be manually reviewed before operational reliance.`, 120),
    finalRationale: wordLimit(`The final recommendation is ${input.recommendation}. This is based on the overall risk position, key drivers, route exposure, source confidence and unresolved intelligence gaps.`, 120),
    source: 'deterministic'
  };
}

function collectMissingItems(trip: Trip | null | undefined, assessment: UnknownRecord): string[] {
  const supplied = stringArray(assessment.missingData ?? assessment.missing_data ?? assessment.intelligenceGaps);
  const primary = trip?.locations?.[0];
  const inferred = [
    !primary?.country && 'destination country',
    !primary?.city && 'destination city',
    !primary?.arrivalDate && 'arrival date',
    !primary?.departureDate && 'departure date',
    !trip?.accommodation && 'accommodation',
    !trip?.flightDetails && 'flight details',
    !trip?.internalMovements && 'internal movements',
    !trip?.meetingsEvents && 'meetings/events',
    !trip?.traveller?.nationality && 'traveller nationality',
    !trip?.traveller?.gender && 'traveller gender',
    !trip?.traveller?.medicalConsiderations && 'medical considerations',
    !trip?.traveller?.purpose && 'travel purpose'
  ].filter(Boolean) as string[];
  return Array.from(new Set([...supplied, ...inferred].map((item) => safeText(item, '').toLowerCase()).filter(Boolean)));
}

function missingDataGroups(missingItems: string[]): VisualReportMissingGroup[] {
  const groups = [
    {
      category: 'Travel logistics',
      keywords: ['destination', 'city', 'country', 'arrival', 'departure', 'flight', 'route', 'movement', 'meeting', 'event'],
      whyItMatters: 'Timing, routing and meeting locations determine exposure to disruption, night movement, road risk and location-specific alerts.',
      whatToAdd: 'Add confirmed flights, arrival time, departure time, internal routes and meeting/event locations.',
      confidenceImpact: 'Route and disruption confidence remains reduced until timings and movements are confirmed.'
    },
    {
      category: 'Accommodation',
      keywords: ['accommodation', 'hotel', 'lodging'],
      whyItMatters: 'Accommodation location affects movement exposure, medical access, secure transport planning and local area risk.',
      whatToAdd: 'Add hotel name, address, check-in/check-out times and any booking reference.',
      confidenceImpact: 'Accommodation and movement recommendations require manual verification until hotel details are supplied.'
    },
    {
      category: 'Documents',
      keywords: ['passport', 'visa', 'ticket', 'document'],
      whyItMatters: 'Document readiness affects border risk, contingency response and duty-of-care tracking.',
      whatToAdd: 'Upload passport metadata, visa/entry evidence, tickets, insurance and relevant booking documents.',
      confidenceImpact: 'Administrative and border-risk confidence is limited without document confirmation.'
    },
    {
      category: 'Medical / insurance',
      keywords: ['medical', 'insurance', 'medication', 'evacuation', 'health'],
      whyItMatters: 'Medical history, insurance and evacuation cover shape health controls and emergency planning.',
      whatToAdd: 'Add declared medical considerations, medication needs, insurer details and evacuation assistance information.',
      confidenceImpact: 'Medical support recommendations remain conservative until health and insurance data are confirmed.'
    },
    {
      category: 'Emergency contacts',
      keywords: ['emergency contact', 'next of kin', 'contact'],
      whyItMatters: 'Emergency contacts are required for incident escalation, welfare checks and support coordination.',
      whatToAdd: 'Add next-of-kin, company security contact, insurer assistance number and local host contact where available.',
      confidenceImpact: 'Response planning confidence is reduced without escalation contacts.'
    },
    {
      category: 'Traveller profile',
      keywords: ['traveller', 'nationality', 'gender', 'purpose', 'profile', 'children', 'high profile'],
      whyItMatters: 'Traveller profile determines exposure, targeting risk, medical assumptions and appropriate operational support.',
      whatToAdd: 'Complete nationality, gender, travel purpose, traveller type, high-profile status, children travelling and risk tolerance.',
      confidenceImpact: 'Personal exposure assessment remains limited until traveller details are complete.'
    }
  ];

  return groups.map((group) => ({
    category: group.category,
    missingItems: missingItems.filter((item) => group.keywords.some((keyword) => item.includes(keyword))).slice(0, 6),
    whyItMatters: group.whyItMatters,
    whatToAdd: group.whatToAdd,
    confidenceImpact: group.confidenceImpact
  })).filter((group) => group.missingItems.length > 0);
}

function sourceLimitationGroup(input: {
  advisories: VisualReportListItem[];
  sourceSummary: VisualReportListItem[];
  hotels: VisualReportHotel[];
  routes: VisualReportRouteSegment[];
}): VisualReportMissingGroup | null {
  const sourceText = input.sourceSummary.map((item) => `${item.title} ${item.detail}`).join(' ').toLowerCase();
  const missing: string[] = [];
  if (!input.advisories.length || input.advisories.some((item) => /limited verified data/i.test(item.detail))) missing.push('official advisories incomplete');
  if (!/health|who|cdc|outbreak/.test(sourceText)) missing.push('health feed missing');
  if (!/aviation|airport|flight/.test(sourceText)) missing.push('aviation feed missing');
  if (input.hotels.length > 0) missing.push('public-map candidate only');
  if (input.routes.length > 0) missing.push('route not analyst validated');
  if (!missing.length) return null;
  return {
    category: 'Source / data limitations',
    missingItems: missing,
    whyItMatters: 'Operational recommendations require clear separation between verified source evidence, public-map candidates and inferred assessment.',
    whatToAdd: 'Connect missing official feeds, validate route and accommodation choices, and record analyst review before high-confidence operational reliance.',
    confidenceImpact: 'Manual review remains required where official advisories, health, aviation, route or hotel validation is incomplete.'
  };
}

function latestSourceDate(items: SourceSummaryItem[]) {
  const dates = items.map((item) => new Date(item.lastUpdated).getTime()).filter((time) => Number.isFinite(time));
  if (!dates.length) return MISSING;
  return new Date(Math.max(...dates)).toISOString();
}

function dataQuality(items: SourceSummaryItem[], confidence: string, missingGroups: VisualReportMissingGroup[]) {
  const liveSourcesCount = items.filter((item) => item.status.toLowerCase().includes('live') || item.status.toLowerCase().includes('connected')).length;
  const fallbackOrMissingSourcesCount = items.filter((item) => {
    const status = item.status.toLowerCase();
    return status.includes('demo') || status.includes('fallback') || status.includes('missing') || status.includes('unavailable');
  }).length;
  return {
    liveSourcesCount,
    fallbackOrMissingSourcesCount,
    latestSourceDate: latestSourceDate(items),
    overallDataConfidence: confidence,
    missingCriticalDataCount: missingGroups.reduce((total, group) => total + group.missingItems.length, 0),
    recommendedNextInputs: missingGroups.length ? missingGroups.map((group) => group.whatToAdd).slice(0, 5) : ['Maintain provider ingestion and refresh advisories before travel.']
  };
}

function dataQualityRating(quality: ReturnType<typeof dataQuality>, confidenceScore: number | null) {
  if (quality.fallbackOrMissingSourcesCount > 0 || quality.missingCriticalDataCount > 5 || (confidenceScore !== null && confidenceScore < 45)) return 'Manual review required';
  if (quality.missingCriticalDataCount > 0 || quality.liveSourcesCount < 2 || (confidenceScore !== null && confidenceScore < 70)) return 'Limited';
  return 'Operationally usable';
}

function manualReviewRequirements(groups: VisualReportMissingGroup[], excludedGlobalEventsCount: number, quality: ReturnType<typeof dataQuality>) {
  const requirements = [
    ...groups.map((group) => `${group.category}: ${group.whatToAdd}`),
    excludedGlobalEventsCount > 0 ? 'Review excluded global or weak-geography events before relying on them operationally.' : '',
    quality.fallbackOrMissingSourcesCount > 0 ? 'Replace fallback or unavailable sources with verified provider evidence.' : '',
    quality.liveSourcesCount < 2 ? 'Confirm at least two live/public source references for high-confidence reliance.' : ''
  ].filter(Boolean);
  return Array.from(new Set(requirements)).slice(0, 8);
}

function cautiousConfidence(confidence: string, quality: ReturnType<typeof dataQuality>) {
  const lower = confidence.toLowerCase();
  if (quality.fallbackOrMissingSourcesCount > 0 || quality.missingCriticalDataCount > 0 || quality.liveSourcesCount < 2) {
    if (lower.includes('high') || lower.includes('verified')) return 'Moderate - inferred from incomplete evidence';
    if (lower.includes('medium')) return 'Moderate - source gaps remain';
    return 'Low - manual review required';
  }
  return confidence;
}

function routeSegments(assessment: UnknownRecord): VisualReportRouteSegment[] {
  const raw = asArray(assessment.routeRisks ?? assessment.route_risks ?? asRecord(assessment.itineraryRisks).routeRisks);
  return limitList(raw, 5).map((item, index) => {
    const record = asRecord(item);
    return {
      segmentName: firstText([record.segmentName, record.segment_name, `Route segment ${index + 1}`], `Route segment ${index + 1}`),
      from: firstText([record.from, record.from_location], MANUAL),
      to: firstText([record.to, record.to_location], MANUAL),
      level: firstText([record.level, levelFromScore(record.score)], MISSING),
      score: firstText([record.score], MISSING),
      mitigation: firstText([record.mitigation, record.recommendedControls, record.recommended_controls], MISSING),
      confidence: firstText([record.confidence], MISSING)
    };
  });
}

function hotelCards(assessment: UnknownRecord): VisualReportHotel[] {
  const itinerary = asRecord(assessment.itineraryRisks);
  const raw = asArray(assessment.hotelSafety ?? assessment.hotelRecommendations ?? itinerary.hotelSafety ?? itinerary.hotelRecommendations);
  return limitList(raw, 3).map((item, index) => {
    const record = asRecord(item);
    return {
      name: firstText([record.hotelName, record.hotel_name, record.name, `Public-map candidate ${index + 1}`], `Public-map candidate ${index + 1}`),
      level: firstText([record.level, levelFromScore(record.score)], MISSING),
      score: firstText([record.score], MISSING),
      strengths: limitList(stringArray(record.strengths), 3),
      concerns: limitList(stringArray(record.concerns), 3),
      note: 'Public-map candidate — manual verification required'
    };
  });
}

function riskBars(overallScore: number | null, overallLevel: string, confidence: string, keyDrivers: VisualReportListItem[], routes: VisualReportRouteSegment[]): VisualReportRiskBar[] {
  const score = overallScore ?? 0;
  const routePeak = Math.max(0, ...routes.map((route) => Number(route.score)).filter((value) => Number.isFinite(value)));
  const driverText = keyDrivers.find((item) => !isUnavailableText(item.detail))?.detail ?? MISSING;
  const bars = [
    ['Security', Math.max(score - 2, 0), driverText],
    ['Crime', Math.max(score - 6, 0), driverText],
    ['Civil unrest', Math.max(score - 10, 0), driverText],
    ['Terrorism/conflict', Math.max(score - 8, 0), driverText],
    ['Health', Math.max(score - 18, 0), 'Health and medical context depends on declared traveller needs and connected health sources.'],
    ['Transport', Math.max(routePeak || score - 5, 0), 'Movement exposure is assessed from submitted route, flight and internal movement data.'],
    ['Natural hazards', Math.max(score - 22, 0), 'Natural hazard confidence depends on connected disaster and weather feeds.'],
    ['Operational confidence', confidence.toLowerCase().includes('low') ? 30 : confidence.toLowerCase().includes('moderate') ? 55 : 75, confidence]
  ] as const;
  return bars.map(([label, value, rationale]) => {
    const bounded = Math.max(0, Math.min(100, Math.round(Number(value))));
    return { label, score: bounded, level: levelFromScore(bounded), rationale: safeText(rationale) };
  });
}

export function buildVisualReportModel(
  report: TripReport,
  assessmentInput?: TripAssessmentRecord | UnknownRecord | null,
  trip?: Trip | null,
  countryProfileInput?: UnknownRecord | null,
  sourcesInput: SourceSummaryItem[] = []
): VisualReportModel {
  const assessment = asRecord(assessmentInput);
  const countryProfile = asRecord(countryProfileInput);
  const primaryLocation = trip?.locations?.[0];
  const destination = [primaryLocation?.city, primaryLocation?.country].filter(Boolean).join(', ') || safeText(countryProfile.name, MANUAL);
  const generatedAt = report.createdAt || new Date().toISOString();
  const validUntil = new Date(new Date(generatedAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const scoreRaw = assessment.score ?? assessment.overall_score;
  const threatScoreRaw = assessment.threatScore ?? assessment.threat_score ?? scoreRaw;
  const confidenceScoreRaw = assessment.confidenceScore ?? assessment.confidence_score;
  const score = Number(scoreRaw);
  const threatScoreValue = Number(threatScoreRaw);
  const confidenceScoreValue = Number(confidenceScoreRaw);
  const overallScore = Number.isFinite(score) ? Math.round(score) : null;
  const threatScore = Number.isFinite(threatScoreValue) ? Math.round(threatScoreValue) : overallScore;
  const confidenceScore = Number.isFinite(confidenceScoreValue) ? Math.round(confidenceScoreValue) : null;
  const overallLevel = firstText([assessment.level, assessment.overall_level, overallScore === null ? undefined : levelFromScore(overallScore)], MISSING);
  const threatLevel = firstText([assessment.threatLevel, assessment.threat_level, threatScore === null ? undefined : levelFromScore(threatScore)], overallLevel);
  const confidence = firstText([assessment.confidence, countryProfile.confidence], MISSING);
  const keyDrivers = listItems(asArray(assessment.keyDrivers ?? assessment.key_drivers), 6, 'Key risk driver');
  const routeText = [trip?.flightDetails, trip?.internalMovements, trip?.meetingsEvents, trip?.accommodation].filter(Boolean).join(' ');
  const advisories = alertItems(countryProfile.advisories as Alert[] | undefined, 6, primaryLocation?.countryIso2, primaryLocation?.city, routeText);
  const excludedGlobalEventsCount = countExcludedGlobalEvents((countryProfile.events as Alert[] | undefined) ?? [], primaryLocation?.countryIso2, primaryLocation?.city, routeText);
  const latestEvents = alertItems(countryProfile.events as Alert[] | undefined, 6, primaryLocation?.countryIso2, primaryLocation?.city, routeText);
  const rawSourceItems = sourcesInput.length ? sourcesInput : assessment.sourceSummary as SourceSummaryItem[] | undefined;
  const sourceSummary = sourceItems(rawSourceItems, 8);
  const routes = routeSegments(assessment);
  const hotels = hotelCards(assessment);
  const missingItems = collectMissingItems(trip, assessment);
  const missingGroups = missingDataGroups(missingItems);
  const gaps = missingItems.length
    ? missingItems.slice(0, 8).map((item) => ({ title: item, detail: 'Add this input to improve itinerary-specific scoring and confidence.' }))
    : listItems(asArray(assessment.missingData ?? assessment.missing_data ?? assessment.intelligenceGaps), 8, 'Intelligence gap');
  const mitigation = listItems(asArray(assessment.recommendedActions ?? assessment.operationalSupportRecommendations), 8, 'Mitigation action');
  const reportSummary = extractMarkdownSection(report.markdown, ['Executive Summary', 'Executive Snapshot'], '');
  const deterministicSummary = deterministicExecutiveSummary({
    destination,
    score: overallScore,
    level: overallLevel,
    recommendation: report.recommendation,
    confidence,
    keyDrivers,
    travellerProfile: safeText(trip?.traveller?.travelStyle, 'traveller'),
    missingItems
  });
  const executiveSummary = sentenceLimit(firstText([reportSummary, countryProfile.summary, deterministicSummary], deterministicSummary), 5);
  const summarySource: VisualReportModel['executiveSnapshot']['summarySource'] = reportSummary ? 'report' : 'deterministic';
  const quality = dataQuality(rawSourceItems ?? [], confidence, missingGroups);
  const displayConfidence = cautiousConfidence(confidence, quality);
  const countryIndicators = listItems(asArray(countryProfile.indicators ?? countryProfile.countryIndicators), 6, 'Country indicator');
  const routeControls = routes.length ? routes.map((route) => ({
    title: route.segmentName,
    detail: route.mitigation,
    level: route.level,
    source: `Confidence: ${route.confidence}`
  })) : [{ title: 'Route controls', detail: 'Limited verified data available — add source/configuration or manual review.' }];
  const hotelStatus = hotels.length ? hotels.map((hotel) => ({
    title: hotel.name,
    detail: hotel.note,
    level: hotel.level,
    source: hotel.score ? `Score: ${hotel.score}` : undefined
  })) : [{ title: 'Hotel safety status', detail: 'Limited verified data available — add source/configuration or manual review.' }];
  const narrative = narrativeBlock({
    destination,
    score: overallScore,
    level: overallLevel,
    recommendation: report.recommendation,
    confidence: displayConfidence,
    keyDrivers,
    missingItems,
    routes,
    hotels,
    advisory: firstText([countryProfile.advisoryPosition, advisories[0]?.title], MISSING)
  });
  const sourceWarnings = sourceLimitationGroup({ advisories, sourceSummary, hotels, routes });
  const allMissingGroups = sourceWarnings ? [...missingGroups, sourceWarnings] : missingGroups;
  const finalQuality = dataQuality(rawSourceItems ?? [], confidence, allMissingGroups);
  const finalDisplayConfidence = cautiousConfidence(confidence, finalQuality);
  const finalDataQualityRating = dataQualityRating(finalQuality, confidenceScore);
  const reviewRequirements = manualReviewRequirements(allMissingGroups, excludedGlobalEventsCount, finalQuality);

  return {
    reportMeta: {
      reportId: report.id,
      title: report.title || 'Travel Risk Report',
      generatedAt,
      validUntil
    },
    executiveSnapshot: {
      destination,
      summary: executiveSummary,
      recommendation: report.recommendation,
      advisory: firstText([countryProfile.advisoryPosition, advisories[0]?.title], MISSING),
      keyIssue: keyDrivers[0]?.detail ?? MISSING,
      keyReason: keyDrivers[0]?.title && !isUnavailableText(keyDrivers[0].detail) ? `${keyDrivers[0].title}: ${keyDrivers[0].detail}` : firstText([keyDrivers[0]?.detail, deterministicSummary], MISSING),
      summarySource
    },
    riskAtGlance: {
      overallScore,
      overallLevel,
      threatRating: threatScore === null ? threatLevel : `${threatLevel} (${threatScore}/100)`,
      confidenceRating: confidenceScore === null ? finalDisplayConfidence : `${finalDisplayConfidence} (${confidenceScore}/100)`,
      dataQualityRating: finalDataQualityRating,
      excludedGlobalEventsCount,
      manualReviewRequirements: reviewRequirements,
      confidence: finalDisplayConfidence,
      badges: [
        { label: 'Threat Rating', value: threatScore === null ? threatLevel : `${threatLevel} (${threatScore}/100)`, tone: riskTone(threatLevel) },
        { label: 'Confidence Rating', value: confidenceScore === null ? finalDisplayConfidence : `${finalDisplayConfidence} (${confidenceScore}/100)`, tone: 'neutral' },
        { label: 'Data Quality', value: finalDataQualityRating, tone: finalDataQualityRating.includes('Manual') ? 'critical' : finalDataQualityRating === 'Limited' ? 'moderate' : 'low' },
        { label: 'Excluded Global Events', value: `${excludedGlobalEventsCount}`, tone: 'neutral' },
        { label: 'Overall Risk', value: overallLevel, tone: riskTone(overallLevel) },
        { label: 'Recommendation', value: report.recommendation, tone: riskTone(report.recommendation) },
        { label: 'Sources', value: `${sourceSummary.length}`, tone: 'neutral' }
      ],
      keyDrivers,
      bars: riskBars(threatScore, threatLevel, finalDisplayConfidence, keyDrivers, routes)
    },
    narrative,
    tripOverview: [
      { label: 'Destination', value: destination },
      { label: 'Dates', value: [primaryLocation?.arrivalDate, primaryLocation?.departureDate].filter(Boolean).join(' to ') || MANUAL },
      { label: 'Purpose', value: safeText(trip?.traveller?.purpose, MANUAL) },
      { label: 'Traveller Profile', value: safeText(trip?.traveller?.travelStyle, MANUAL) },
      { label: 'Accommodation', value: safeText(trip?.accommodation, MANUAL) },
      { label: 'Flights', value: safeText(trip?.flightDetails, MANUAL) }
    ],
    routeAndMovement: {
      segments: routes,
      note: routes.length ? 'Route scoring is based on submitted itinerary details and available sourced risk context.' : MANUAL
    },
    accommodationSafety: {
      hotels,
      note: hotels.length ? 'Hotel entries are public-map candidates unless explicitly marked as verified. Manual selection of a known secure business hotel remains advised.' : 'No verified hotel recommendations available from free sources. Manual verification required.'
    },
    healthAndMedical: listItems(asArray(assessment.medicalSupportRecommendations ?? assessment.healthMedical), 4, 'Health and medical'),
    emergencyAndConsular: listItems(asArray(assessment.embassySupportRecommendations ?? assessment.emergencyConsular), 4, 'Emergency and consular'),
    advisories: advisories.length ? advisories : [{ title: 'Current advisories', detail: MISSING }],
    latestEvents: latestEvents.length ? latestEvents : [{ title: 'Latest relevant events', detail: MISSING }],
    intelligenceGaps: gaps,
    missingDataGroups: allMissingGroups.length ? allMissingGroups : [{
      category: 'Current data position',
      missingItems: ['No material missing inputs identified from the available trip record.'],
      whyItMatters: 'Complete inputs improve the precision of recommendations and reduce manual assumptions.',
      whatToAdd: 'Continue to refresh advisories, route details and documents as travel dates approach.',
      confidenceImpact: 'Confidence remains aligned to source freshness and provider availability.'
    }],
    mitigationPlan: mitigation,
    dataDepth: {
      officialAdvisories: advisories.length ? advisories : [{ title: 'Official advisories', detail: 'Limited verified data available — add source/configuration or manual review.' }],
      countryIndicators: countryIndicators[0]?.detail === MISSING ? [{ title: 'Country indicators', detail: 'Limited verified data available — add source/configuration or manual review.' }] : countryIndicators,
      healthMedicalContext: listItems(asArray(assessment.medicalSupportRecommendations ?? assessment.healthMedical), 4, 'Health and medical context'),
      routeMovementControls: routeControls,
      hotelSafetyStatus: hotelStatus,
      sourceConfidence: sourceSummary.length ? sourceSummary : [{ title: 'Source confidence', detail: 'Limited verified data available — add source/configuration or manual review.' }]
    },
    dataQuality: { ...finalQuality, overallDataConfidence: finalDisplayConfidence, recommendedNextInputs: reviewRequirements.length ? reviewRequirements : finalQuality.recommendedNextInputs },
    goNoGo: {
      recommendation: report.recommendation,
      rationale: extractMarkdownSection(report.markdown, ['Go / No-Go Recommendation', 'Final Recommendation', 'Conclusion'], safeText(assessment.recommendation, MISSING))
    },
    sourceSummary: sourceSummary.length ? sourceSummary : [{ title: 'Source summary', detail: MISSING }]
  };
}
