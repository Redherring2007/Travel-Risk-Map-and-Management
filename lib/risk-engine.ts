import type { Alert, CityProfile, Confidence, CountryProfile, DataStatus, RiskCategory, RiskLevel, RiskScore, TravellerProfile, Trip } from './types';
import { filterRelevantAlerts, scoreEventRelevance } from './event-relevance';

export const riskCategories: RiskCategory[] = [
  'security', 'crime', 'political', 'terrorismConflict', 'kidnapExtortion', 'health',
  'medical', 'naturalDisaster', 'transport', 'infrastructure', 'legalCultural', 'travelDisruption'
];

export const riskCategoryLabels: Record<string, string> = {
  overall: 'Overall', security: 'Security', crime: 'Crime', political: 'Political', terrorismConflict: 'Terrorism/conflict', kidnapExtortion: 'Kidnap', health: 'Health', medical: 'Medical', naturalDisaster: 'Natural hazards', transport: 'Transport', infrastructure: 'Infrastructure', legalCultural: 'Legal/cultural', travelDisruption: 'Travel disruption'
};

export type AtlasRiskResult = {
  score: number;
  level: RiskLevel;
  recommendation: 'Go' | 'Go With Caution' | 'Avoid';
  confidence: Confidence;
  keyDrivers: string[];
  sourceSummary: Array<{ source: string; status: string; confidence: string; lastUpdated?: string; records?: number }>;
  missingData: string[];
  freshness: { status: 'fresh' | 'stale' | 'limited' | 'demo'; confidenceModifier: number; notes: string[] };
};

export type RouteSegmentRisk = { segmentName: string; from?: string; to?: string; score: number; level: RiskLevel; drivers: string[]; mitigation: string };

export function riskLevel(value: number): RiskLevel {
  if (value >= 75) return 'Critical';
  if (value >= 50) return 'High';
  if (value >= 25) return 'Moderate';
  return 'Low';
}

export function riskMeaning(value: number): string {
  const level = riskLevel(value);
  if (level === 'Critical') return 'Severe risk; travel should be avoided or require specialist support.';
  if (level === 'High') return 'Elevated threat environment; enhanced planning and controls required.';
  if (level === 'Moderate') return 'Manageable risk with preparation, local awareness, and contingency planning.';
  return 'Generally stable operating environment; standard precautions are usually sufficient.';
}

export function score(category: RiskCategory | 'overall', value: number, sources: string[], confidence: Confidence = 'Medium', sourceStatus: DataStatus = 'demo'): RiskScore {
  const bounded = Math.max(0, Math.min(100, Math.round(value)));
  return { category, value: bounded, level: riskLevel(bounded), meaning: riskMeaning(bounded), confidence, lastUpdated: new Date().toISOString(), sources, sourceStatus };
}

export function overallRisk(scores: RiskScore[]): RiskScore {
  const categories = scores.filter((item) => item.category !== 'overall');
  const weighted = categories.reduce((total, item) => total + item.value, 0) / Math.max(categories.length, 1);
  const statuses = new Set(categories.map((item) => item.sourceStatus));
  return score('overall', weighted, Array.from(new Set(categories.flatMap((item) => item.sources))), 'Medium', statuses.has('live') ? 'live' : statuses.has('limited') ? 'limited' : 'demo');
}

export function recommendationFromScore(value: number): 'Go' | 'Go With Caution' | 'Avoid' {
  if (value >= 75) return 'Avoid';
  if (value >= 45) return 'Go With Caution';
  return 'Go';
}

export function advisoryLevelToScore(text = '') {
  const value = text.toLowerCase();
  if (/(do not travel|avoid all travel|avoid travel)/.test(value)) return 75;
  if (/(avoid all but essential|all but essential)/.test(value)) return 65;
  if (/(reconsider travel|reconsider|avoid non-essential)/.test(value)) return 60;
  if (/(increased caution|exercise caution|high degree of caution)/.test(value)) return 35;
  if (/(normal precautions|usual precautions|low)/.test(value)) return 15;
  return 25;
}

export function severityToScore(severity: string) {
  if (severity === 'Critical') return 85;
  if (severity === 'High') return 65;
  if (severity === 'Moderate') return 40;
  return 18;
}

export function freshnessConfidence(sourceSummary: AtlasRiskResult['sourceSummary'] = []) {
  if (!sourceSummary.length) return { status: 'limited' as const, confidenceModifier: -20, notes: ['No source freshness records available.'] };
  const live = sourceSummary.filter((item) => /live|active|public/i.test(item.status)).length;
  const stale = sourceSummary.filter((item) => item.lastUpdated && Date.now() - new Date(item.lastUpdated).getTime() > 1000 * 60 * 60 * 24 * 7).length;
  if (live === 0) return { status: 'demo' as const, confidenceModifier: -25, notes: ['Demo or fallback source set only.'] };
  if (stale > live / 2) return { status: 'stale' as const, confidenceModifier: -12, notes: ['Several source records are older than seven days.'] };
  return { status: 'fresh' as const, confidenceModifier: 0, notes: ['Source freshness is acceptable for MVP assessment.'] };
}

function confidenceFrom(scoreValue: number, missing: string[], freshness: ReturnType<typeof freshnessConfidence>): Confidence {
  const penalty = missing.length * 8 - freshness.confidenceModifier;
  if (penalty > 25 || scoreValue === 0) return 'Low';
  if (penalty > 8 || freshness.status === 'stale') return 'Medium';
  return 'High';
}

function eventDrivers(events: Alert[]) {
  return events.filter((event) => ['High', 'Critical'].includes(event.severity)).slice(0, 6).map((event) => `${event.severity}: ${event.title}`);
}

function eventPressure(events: Alert[], countryIso2?: string, cityName?: string) {
  const relevant = filterRelevantAlerts(events, countryIso2, cityName, 50).slice(0, 12);
  return Math.min(12, relevant.reduce((total, event) => {
    const relevance = scoreEventRelevance(event, countryIso2, cityName);
    return total + (severityToScore(event.severity) / 100) * (relevance.relevanceScore / 100) * 5;
  }, 0));
}

export function calculateCountryRiskFromSources(input: { country?: CountryProfile | null; advisories?: Alert[]; events?: Alert[]; sourceSummary?: AtlasRiskResult['sourceSummary'] }): AtlasRiskResult {
  const countryScore = input.country?.risk.find((item) => item.category === 'overall')?.value ?? 20;
  const advisoryFloor = Math.max(0, ...(input.advisories ?? []).map((item) => Math.max(severityToScore(item.severity), advisoryLevelToScore(`${item.title} ${item.summary} ${item.recommendedAction}`))));
  const pressure = eventPressure(input.events ?? [], input.country?.iso2);
  const base = Math.max(countryScore, advisoryFloor) + pressure;
  const missing = input.country ? [] : ['country profile'];
  const freshness = freshnessConfidence(input.sourceSummary ?? []);
  const finalScore = Math.max(0, Math.min(100, Math.round(base)));
  const relevantEvents = filterRelevantAlerts(input.events ?? [], input.country?.iso2, undefined, 50);
  return { score: finalScore, level: riskLevel(finalScore), recommendation: recommendationFromScore(finalScore), confidence: confidenceFrom(finalScore, missing, freshness), keyDrivers: [...eventDrivers(relevantEvents), advisoryFloor ? 'Government advisory floor applied' : 'Baseline country profile'], sourceSummary: input.sourceSummary ?? [], missingData: missing, freshness };
}

export function calculateCityRiskFromSources(input: { city?: CityProfile | null; events?: Alert[]; countryRisk?: AtlasRiskResult }) {
  const cityScore = input.city?.risk.find((item) => item.category === 'overall')?.value ?? Math.max(20, (input.countryRisk?.score ?? 25) - 8);
  const relevant = filterRelevantAlerts(input.events ?? [], input.city?.countryIso2, input.city?.name, 55);
  const peakEvent = Math.max(0, ...relevant.map((event) => Math.round(severityToScore(event.severity) * (scoreEventRelevance(event, input.city?.countryIso2, input.city?.name).relevanceScore / 100))));
  const value = Math.max(cityScore, peakEvent);
  return { score: value, level: riskLevel(value), drivers: input.city ? [input.city.overview, ...eventDrivers(relevant)].slice(0, 5) : ['Limited verified city data available'] };
}

export function calculateRouteSegmentRisk(input: { segmentName: string; notes?: string; countryRisk?: AtlasRiskResult; cityRiskScore?: number }): RouteSegmentRisk {
  const text = `${input.segmentName} ${input.notes ?? ''}`.toLowerCase();
  let value = Math.max(input.cityRiskScore ?? 0, input.countryRisk?.score ?? 20);
  const drivers: string[] = [];
  if (/(night|after dark|road|drive|transfer)/.test(text)) { value += 8; drivers.push('Road or after-dark movement exposure'); }
  if (/(airport|border|flight)/.test(text)) { value += 5; drivers.push('Airport/border disruption exposure'); }
  if (/(meeting|event|executive|public)/.test(text)) { value += 6; drivers.push('Profile or event exposure'); }
  value = Math.min(100, Math.round(value));
  return { segmentName: input.segmentName, score: value, level: riskLevel(value), drivers: drivers.length ? drivers : ['Baseline route exposure'], mitigation: value >= 60 ? 'Use vetted transport, confirm timings, maintain comms and pre-brief alternates.' : 'Use normal movement planning and monitor alerts.' };
}

export function calculateTripRisk(input: { trip: Trip; country?: CountryProfile | null; city?: CityProfile | null; advisories?: Alert[]; events?: Alert[]; sourceSummary?: AtlasRiskResult['sourceSummary'] }): AtlasRiskResult & { routeRisks: RouteSegmentRisk[]; itineraryRisks: Record<string, unknown> } {
  const countryRisk = calculateCountryRiskFromSources({ country: input.country, advisories: input.advisories, events: input.events, sourceSummary: input.sourceSummary });
  const cityRisk = calculateCityRiskFromSources({ city: input.city, events: input.events, countryRisk });
  const traveller = input.trip.traveller;
  const missing = [...countryRisk.missingData];
  const primary = input.trip.locations[0];
  if (!primary?.country) missing.push('destination country');
  if (!primary?.city) missing.push('destination city');
  if (!primary?.arrivalDate || !primary?.departureDate) missing.push('travel dates');
  if (!input.trip.accommodation) missing.push('accommodation');
  if (!input.trip.flightDetails) missing.push('flight details');
  if (!input.trip.internalMovements) missing.push('internal movements');
  if (!traveller?.nationality) missing.push('traveller nationality');

  let uplift = 0;
  const drivers = [...countryRisk.keyDrivers];
  if (traveller?.highProfile) { uplift += 8; drivers.push('High-profile traveller uplift'); }
  if (traveller?.childrenTravelling) { uplift += 5; drivers.push('Children travelling uplift'); }
  if (traveller?.hostileEnvironmentSupport) { uplift += 6; drivers.push('Hostile/high-risk environment support flag'); }
  if (traveller?.riskTolerance === 'low') { uplift += 4; drivers.push('Low risk tolerance'); }

  const routeRisks = [
    calculateRouteSegmentRisk({ segmentName: 'Flights / airport / border', notes: input.trip.flightDetails, countryRisk, cityRiskScore: cityRisk.score }),
    calculateRouteSegmentRisk({ segmentName: 'Internal movements', notes: input.trip.internalMovements, countryRisk, cityRiskScore: cityRisk.score }),
    calculateRouteSegmentRisk({ segmentName: 'Meetings / events', notes: input.trip.meetingsEvents, countryRisk, cityRiskScore: cityRisk.score })
  ];
  const routePeak = Math.max(...routeRisks.map((item) => item.score));
  const value = Math.min(100, Math.round(Math.max(countryRisk.score, cityRisk.score, routePeak) + uplift + Math.min(10, missing.length * 1.5)));
  const freshness = countryRisk.freshness;
  return { score: value, level: riskLevel(value), recommendation: recommendationFromScore(value), confidence: confidenceFrom(value, missing, freshness), keyDrivers: Array.from(new Set([...drivers, ...routeRisks.flatMap((item) => item.drivers)])).slice(0, 10), sourceSummary: input.sourceSummary ?? countryRisk.sourceSummary, missingData: Array.from(new Set(missing)), freshness, routeRisks, itineraryRisks: { country: countryRisk, city: cityRisk, traveller: { highProfile: traveller?.highProfile, travelStyle: traveller?.travelStyle, riskTolerance: traveller?.riskTolerance } } };
}

export const calculateAtlasTravelRisk = calculateTripRisk;
