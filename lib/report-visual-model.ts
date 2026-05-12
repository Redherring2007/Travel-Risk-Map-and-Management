
function safeText(value: unknown, fallback = "Limited verified data available"): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number") return String(value);
  return fallback;
}

function limitList<T>(items: T[] | undefined | null, limit: number): T[] {
  return Array.isArray(items) ? items.slice(0, limit) : [];
}

function dedupeByTitleOrSource<T extends object>(items: T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  return items.filter((item) => {
    const record = item as Record<string, unknown>;
    const key = String(record.title ?? record.source ?? record.name ?? JSON.stringify(item).slice(0, 80)).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function removeFallbackStatusItems<T extends object>(items: T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    const record = item as Record<string, unknown>;
    const status = String(record.status ?? record.sourceStatus ?? "").toLowerCase();
    const title = String(record.title ?? "").toLowerCase();
    return !status.includes("demo_fallback") && !title.includes("demo fallback active");
  });
}

import type { MergedCountryProfile } from './country-profile-merge';
import type { TripAssessmentRecord } from './trip-assessment';
import type { Alert, RiskLevel, Trip, TripReport } from './types';

type SourceSummary = { source: string; status: string; confidence: string; lastUpdated?: string; records?: number };

type VisualItem = { title: string; detail: string; meta?: string; level?: RiskLevel | string; score?: number; source?: string; date?: string };

type VisualHotel = { name: string; level: RiskLevel | string; score?: number; strengths: string[]; concerns: string[]; controls: string[]; confidence?: string; note: string };
type VisualRoute = { segment: string; from?: string; to?: string; level: RiskLevel | string; score?: number; mitigation: string; drivers: string[] };

export type VisualReportModel = {
  reportMeta: { id: string; title: string; generatedDate: string; validUntil: string; standardReportAvailable: boolean };
  tripOverview: { destination: string; country: string; city: string; dates: string; purpose: string; travellerProfile: string; accommodation: string; flights: string };
  overallRisk: { level: RiskLevel | string; score: number | null; recommendation: string; narrative: string };
  riskAtGlance: Array<{ label: string; level: RiskLevel | string; score: number | null }>;
  confidence: { level: string; evidenceConfidence: string; note: string };
  keyRiskDrivers: string[];
  itineraryRisk: VisualRoute[];
  mapPanel: { title: string; detail: string; locations: Array<{ label: string; detail: string }> };
  accommodationSafety: { summary: string; hotels: VisualHotel[]; warning: string };
  healthMedical: { summary: string; items: string[] };
  emergencyConsular: { summary: string; items: string[] };
  advisories: VisualItem[];
  latestEvents: VisualItem[];
  intelligenceGaps: string[];
  mitigationPlan: string[];
  goNoGoRecommendation: { decision: string; detail: string };
  sourceSummary: SourceSummary[];
};

function scoreForMergedValue(value: number) {
  if (value >= 75) return 'Critical';
  if (value >= 50) return 'High';
  if (value >= 25) return 'Moderate';
  return 'Low';
}

const limited = 'Limited verified data available';
const manual = 'Manual verification required';

function addDays(value: string, days: number) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.valueOf())) return new Date(Date.now() + days * 86400000).toISOString();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function text(value: unknown, fallback = limited) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function unique(items: string[], limit = 8) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

function nested<T>(value: unknown, key: string): T[] {
  if (!value || typeof value !== 'object') return [];
  const item = (value as Record<string, unknown>)[key];
  return Array.isArray(item) ? item as T[] : [];
}

function eventItem(event: Alert): VisualItem {
  return { title: event.title, detail: event.summary || limited, meta: `${event.country}${event.city ? ` / ${event.city}` : ''}`, level: event.severity, source: event.source, date: event.timestamp };
}

function sourceItems(profile: MergedCountryProfile | null, extraSources: SourceSummary[] = []) {
  const combined = [...(profile?.sources ?? []), ...extraSources];
  const seen = new Set<string>();
  return combined.filter((source) => {
    const key = `${source.source}|${source.status}|${source.lastUpdated ?? ''}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function extractExecutiveLine(markdown: string) {
  const section = markdown.match(/## Executive Summary\s+([\s\S]*?)(\n## |$)/i)?.[1] ?? '';
  return section.replace(/[#*_`>-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 420);
}

export function buildVisualReportModel(report: TripReport, assessment: TripAssessmentRecord | null, trip: Trip | null, countryProfile: MergedCountryProfile | null, sources: SourceSummary[] = []): VisualReportModel {
  const primary = trip?.locations[0];
  const itineraryRisks = assessment?.itineraryRisks ?? {};
  const savedHotelSafety = nested<VisualHotel & { hotelName?: string; recommendedControls?: string[]; reviewDataNote?: string }>(itineraryRisks, 'hotelSafety');
  const savedRouteRisk = nested<VisualRoute & { segmentName?: string }>(itineraryRisks, 'routeRisk');
  const hotelSafety = (assessment?.hotelSafety ?? savedHotelSafety).slice(0, 3);
  const routeRisk = (assessment?.routeRisk ?? savedRouteRisk ?? assessment?.routeRisks ?? []).slice(0, 6);
  const filteredAdvisories = limitList(removeFallbackStatusItems(dedupeByTitleOrSource(countryProfile?.advisoryPosition ?? [])), 6);
  const filteredEvents = limitList(removeFallbackStatusItems(dedupeByTitleOrSource(countryProfile?.events ?? [])), 6);
  const advisories = filteredAdvisories.map(eventItem);
  const events = filteredEvents.map(eventItem);
  const planning = itineraryRisks.planningChecklist && typeof itineraryRisks.planningChecklist === 'object' ? itineraryRisks.planningChecklist as { intelligenceGaps?: string[]; sourceSummary?: string[] } : null;
  const medical = nested<string>(itineraryRisks, 'medicalSupportRecommendations');
  const embassy = nested<string>(itineraryRisks, 'embassySupportRecommendations');
  const operational = nested<string>(itineraryRisks, 'operationalSupportRecommendations');
  const recommended = assessment?.recommendedActions ?? [];
  const gaps = unique([...(assessment?.missingData ?? []), ...(planning?.intelligenceGaps ?? []), ...(countryProfile?.intelligenceGaps ?? [])], 10);
  const overviewLine = extractExecutiveLine(report.markdown);
  const score = assessment?.score ?? null;
  const level = assessment?.level ?? (score !== null ? scoreForMergedValue(score) : 'Unknown');

  return {
    reportMeta: { id: report.id, title: 'Travel Risk Report', generatedDate: report.createdAt, validUntil: addDays(report.createdAt, 7), standardReportAvailable: Boolean(report.markdown) },
    tripOverview: {
      destination: primary ? `${primary.city}, ${primary.country}` : limited,
      country: text(primary?.country),
      city: text(primary?.city),
      dates: primary?.arrivalDate && primary.departureDate ? `${primary.arrivalDate} to ${primary.departureDate}` : limited,
      purpose: text(trip?.traveller.purpose),
      travellerProfile: trip ? `${trip.traveller.travelStyle}; nationality ${trip.traveller.nationality || limited}; ${trip.traveller.highProfile ? 'high-profile traveller' : 'standard profile'}` : limited,
      accommodation: text(trip?.accommodation, manual),
      flights: text(trip?.flightDetails, manual)
    },
    overallRisk: {
      level,
      score,
      recommendation: report.recommendation,
      narrative: overviewLine || `${report.recommendation}. ${assessment ? `Overall score ${assessment.score}/100 with ${assessment.confidence} confidence.` : 'Assessment data is limited.'}`
    },
    riskAtGlance: [
      { label: 'Country', level: String((itineraryRisks.country as { level?: string; score?: number } | undefined)?.level ?? level), score: (itineraryRisks.country as { score?: number } | undefined)?.score ?? score },
      { label: 'City', level: String((itineraryRisks.city as { level?: string; score?: number } | undefined)?.level ?? level), score: (itineraryRisks.city as { score?: number } | undefined)?.score ?? null },
      { label: 'Route', level: routeRisk[0]?.level ?? 'Unknown', score: routeRisk[0]?.score ?? null },
      { label: 'Accommodation', level: hotelSafety[0]?.level ?? 'Unknown', score: hotelSafety[0]?.score ?? null },
      { label: 'Medical', level: medical.length ? level : 'Unknown', score: null }
    ],
    confidence: { level: assessment?.confidence ?? 'Low', evidenceConfidence: countryProfile?.confidence ?? 'Low', note: 'Evidence has been deduplicated locally for the visual report. Missing or fallback-only records are shown as limited verified data.' },
    keyRiskDrivers: unique(assessment?.keyDrivers ?? [], 8),
    itineraryRisk: routeRisk.map((route) => { const item = route as { segmentName?: string; segment?: string; from?: string; to?: string; level?: string; score?: number; mitigation?: string; drivers?: string[] }; return { segment: text(item.segmentName ?? item.segment, 'Route segment'), from: item.from, to: item.to, level: item.level ?? 'Unknown', score: item.score, mitigation: text(item.mitigation, manual), drivers: unique(item.drivers ?? [], 4) }; }),
    mapPanel: { title: 'Area Risk Snapshot', detail: primary ? `${primary.city}, ${primary.country}. Visual map rendering is intentionally placeholder-only in this report; no unsourced map intelligence is generated.` : limited, locations: [{ label: 'Destination', detail: primary ? `${primary.city}, ${primary.country}` : limited }, { label: 'Accommodation', detail: text(trip?.accommodation, manual) }, { label: 'Airport/flight', detail: text(trip?.flightDetails, manual) }] },
    accommodationSafety: {
      summary: hotelSafety.length ? 'Public-map hotel candidates were scored as orientation aids only. They are not endorsed hotel recommendations.' : 'No verified hotel recommendations available from free sources. Recommend manual selection of a known secure business hotel.',
      hotels: hotelSafety.map((hotel) => { const item = hotel as { hotelName?: string; name?: string; level?: string; score?: number; strengths?: string[]; concerns?: string[]; recommendedControls?: string[]; controls?: string[]; confidence?: string; reviewDataNote?: string; note?: string }; return { name: text(item.hotelName ?? item.name, 'Hotel candidate'), level: item.level ?? 'Unknown', score: item.score, strengths: unique(item.strengths ?? [], 3), concerns: unique(item.concerns ?? [], 3), controls: unique(item.recommendedControls ?? item.controls ?? [], 4), confidence: item.confidence, note: text(item.reviewDataNote ?? item.note, 'These are public-map candidates, not verified hotel recommendations.') }; }),
      warning: 'These are public-map candidates, not verified hotel recommendations. Manual verification required.'
    },
    healthMedical: { summary: medical[0] ?? 'Medical planning should verify insurance, medication availability, suitable hospitals and evacuation triggers.', items: unique(medical, 5) },
    emergencyConsular: { summary: embassy[0] ?? 'Consular and emergency support details require manual verification before travel.', items: unique(embassy, 5) },
    advisories,
    latestEvents: events,
    intelligenceGaps: gaps.length ? gaps : ['No major intelligence gaps identified in the available assessment.'],
    mitigationPlan: unique([...recommended, ...operational], 10),
    goNoGoRecommendation: { decision: report.recommendation, detail: `${report.recommendation}. Implement listed controls and accept remaining intelligence gaps before travel.` },
    sourceSummary: sourceItems(countryProfile, [...sources, ...(assessment?.sourceSummary ?? [])]).slice(0, 8)
  };
}