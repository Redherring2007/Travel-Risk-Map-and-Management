import { randomUUID } from 'crypto';
import { aiStatus, generateItineraryRiskAssessment, generateTravelRiskReport } from './ai';
import { findCountry } from './data';
import { mergeCountryProfile, type MergedCountryProfile } from './country-profile-merge';
import { scoreHotelsForMergedProfile, type HotelSafetyScore } from './hotel-safety';
import { isNeonConfigured, query } from './neon';
import { calculateTripRisk, type AtlasRiskResult, type RouteSegmentRisk } from './risk-engine';
import { assessRouteRisk, type OperationalRouteRisk } from './route-risk';
import { loadCityProfile, loadFreshnessSummary, loadRelevantAdvisories, loadRelevantEvents } from './source-data';
import { store } from './store';
import { buildTripPlanningChecklist, type TravelRecommendationOutput } from './travel-recommendation-engine';
import type { Alert, Trip, TripReport } from './types';

export type TripAssessmentRecord = AtlasRiskResult & {
  id: string;
  tripId: string;
  routeRisks: RouteSegmentRisk[];
  itineraryRisks: Record<string, unknown>;
  aiAssessment?: Awaited<ReturnType<typeof generateItineraryRiskAssessment>>;
  missingTripComponents?: string[];
  recommendedActions?: string[];
  hotelSafety?: HotelSafetyScore[];
  routeRisk?: OperationalRouteRisk[];
  medicalSupportRecommendations?: string[];
  embassySupportRecommendations?: string[];
  operationalSupportRecommendations?: string[];
  planningChecklist?: TravelRecommendationOutput;
  mergedCountryProfile?: MergedCountryProfile;
  createdAt: string;
};

const memoryAssessments = new Map<string, TripAssessmentRecord[]>();

function sourceList(advisories: Alert[], events: Alert[], freshness: AtlasRiskResult['sourceSummary']) {
  return Array.from(new Set([
    ...freshness.map((item) => `${item.source} (${item.status}; ${item.confidence}; ${item.lastUpdated})`),
    ...advisories.map((item) => `${item.source}: ${item.title}`),
    ...events.map((item) => `${item.source}: ${item.title}`)
  ])).filter(Boolean);
}

function normaliseAssessment(row: {
  id: string;
  trip_id: string;
  overall_score: number;
  overall_level: AtlasRiskResult['level'];
  confidence: AtlasRiskResult['confidence'];
  key_drivers: string[] | null;
  itinerary_risks: Record<string, unknown> | null;
  route_risks: RouteSegmentRisk[] | null;
  missing_data: string[] | null;
  source_summary: AtlasRiskResult['sourceSummary'] | null;
  freshness: AtlasRiskResult['freshness'] | null;
  created_at: string;
}): TripAssessmentRecord {
  const score = Number(row.overall_score);
  return {
    id: row.id,
    tripId: row.trip_id,
    score,
    level: row.overall_level,
    recommendation: score >= 75 ? 'Avoid' : score >= 45 ? 'Go With Caution' : 'Go',
    confidence: row.confidence,
    keyDrivers: row.key_drivers ?? [],
    sourceSummary: row.source_summary ?? [],
    missingData: row.missing_data ?? [],
    freshness: row.freshness ?? { status: 'limited', confidenceModifier: 0, notes: ['Loaded from saved assessment.'] },
    routeRisks: row.route_risks ?? [],
    itineraryRisks: row.itinerary_risks ?? {},
    createdAt: row.created_at
  };
}

export async function buildTripAssessmentContext(trip: Trip) {
  const primary = trip.locations[0];
  const country = findCountry(primary?.countryIso2 ?? primary?.country ?? '') ?? null;
  const city = loadCityProfile(country?.iso2 ?? primary?.countryIso2, primary?.city);
  const [documents, advisories, events, freshness] = await Promise.all([
    store.listDocuments(trip.id),
    loadRelevantAdvisories(country?.iso2 ?? primary?.countryIso2),
    loadRelevantEvents(country?.iso2 ?? primary?.countryIso2, primary?.city),
    loadFreshnessSummary()
  ]);
  const mergedProfile = await mergeCountryProfile(country?.iso2 ?? primary?.countryIso2, primary?.city);
  const sources = sourceList(advisories, events, freshness);
  return { country, city, documents, advisories, events, freshness, mergedProfile, sources: Array.from(new Set([...sources, ...mergedProfile.sources.map((item) => `${item.source} (${item.status}; ${item.confidence}; ${item.lastUpdated})`)])) };
}

export async function assessTripRisk(trip: Trip): Promise<TripAssessmentRecord> {
  const context = await buildTripAssessmentContext(trip);
  const risk = calculateTripRisk({
    trip,
    country: context.country,
    city: context.city,
    advisories: context.advisories,
    events: context.events,
    sourceSummary: context.freshness
  });
  const cityRiskScore = typeof risk.itineraryRisks.city === 'object' && risk.itineraryRisks.city && 'score' in risk.itineraryRisks.city ? Number((risk.itineraryRisks.city as { score?: number }).score) : undefined;
  const routeRisk = assessRouteRisk({ trip, countryRiskScore: risk.score, cityRiskScore, mergedProfile: context.mergedProfile });
  const hotelSafety = scoreHotelsForMergedProfile({ mergedProfile: context.mergedProfile, countryRiskScore: risk.score, cityRiskScore, traveller: trip.traveller, movementNotes: `${trip.flightDetails} ${trip.internalMovements}` });
  const planningChecklist = buildTripPlanningChecklist({ trip, documents: context.documents, profile: context.mergedProfile, hotelSafety, routeRisk, score: risk.score });
  const enrichedRisk = {
    ...risk,
    sourceSummary: Array.from(new Map([...risk.sourceSummary, ...context.mergedProfile.sources].map((item) => [item.source, item])).values()),
    missingData: Array.from(new Set([...risk.missingData, ...planningChecklist.missingFields, ...planningChecklist.intelligenceGaps])),
    keyDrivers: Array.from(new Set([...risk.keyDrivers, ...routeRisk.flatMap((segment) => segment.drivers), ...planningChecklist.operationalSupport])).slice(0, 16),
    routeRisks: routeRisk.map((segment) => ({ segmentName: segment.segmentName, from: segment.from, to: segment.to, score: segment.score, level: segment.level, drivers: segment.drivers, mitigation: segment.mitigation })),
    routeRisk,
    hotelSafety,
    missingTripComponents: planningChecklist.missingFields,
    recommendedActions: planningChecklist.recommendedActions,
    medicalSupportRecommendations: planningChecklist.medicalRecommendations,
    embassySupportRecommendations: planningChecklist.embassyRecommendations,
    operationalSupportRecommendations: planningChecklist.operationalSupport,
    planningChecklist,
    mergedCountryProfile: context.mergedProfile
  };
  const aiAssessment = await generateItineraryRiskAssessment({ trip, assessment: enrichedRisk, sources: context.sources });
  const createdAt = new Date().toISOString();
  const record: TripAssessmentRecord = { ...enrichedRisk, id: randomUUID(), tripId: trip.id, aiAssessment, createdAt };

  if (!isNeonConfigured()) {
    const list = memoryAssessments.get(trip.id) ?? [];
    memoryAssessments.set(trip.id, [record, ...list]);
    return record;
  }

  const rows = await query<{ id: string; created_at: string }>(
    `insert into trip_risk_assessments (trip_id, overall_score, overall_level, confidence, key_drivers, itinerary_risks, route_risks, missing_data, source_summary, freshness, generated_by)
     values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11) returning id, created_at`,
    [trip.id, record.score, record.level, record.confidence, JSON.stringify(record.keyDrivers), JSON.stringify({ ...record.itineraryRisks, planningChecklist: record.planningChecklist, hotelSafety: record.hotelSafety, routeRisk: record.routeRisk, medicalSupportRecommendations: record.medicalSupportRecommendations, embassySupportRecommendations: record.embassySupportRecommendations, operationalSupportRecommendations: record.operationalSupportRecommendations }), JSON.stringify(record.routeRisks), JSON.stringify(record.missingData), JSON.stringify(record.sourceSummary), JSON.stringify(record.freshness), record.aiAssessment?.configured ? 'ai_assisted' : 'rules_engine']
  ).catch(() => []);

  if (rows[0]) {
    record.id = rows[0].id;
    record.createdAt = rows[0].created_at;
    await Promise.all(record.routeRisks.map((segment, index) => query(
      `insert into route_risk_segments (trip_id, assessment_id, sequence, segment_name, from_location, to_location, score, level, drivers, mitigation)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10)`,
      [trip.id, record.id, index + 1, segment.segmentName, segment.from ?? null, segment.to ?? null, segment.score, segment.level, JSON.stringify(segment.drivers), segment.mitigation]
    ).catch(() => [])));
    await Promise.all((record.hotelSafety ?? []).map((hotel) => query(
      `insert into hotel_safety_scores (country_iso2, score, level, rationale, source, confidence, raw_payload)
       values ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
      [trip.locations[0]?.countryIso2 ?? null, hotel.score, hotel.level, [...hotel.strengths, ...hotel.concerns].join('; '), 'Atlas deterministic hotel safety scoring', hotel.confidence, JSON.stringify(hotel)]
    ).catch(() => []))); 
  }
  return record;
}

export async function getLatestTripAssessment(tripId: string): Promise<TripAssessmentRecord | null> {
  if (!isNeonConfigured()) return memoryAssessments.get(tripId)?.[0] ?? null;
  const rows = await query<Parameters<typeof normaliseAssessment>[0]>(
    `select * from trip_risk_assessments where trip_id = $1 order by created_at desc limit 1`,
    [tripId]
  ).catch(() => []);
  return rows[0] ? normaliseAssessment(rows[0]) : null;
}

export async function generateAndSaveOperationalReport(trip: Trip, assessment?: TripAssessmentRecord) {
  const context = await buildTripAssessmentContext(trip);
  const activeAssessment = assessment ?? (await getLatestTripAssessment(trip.id)) ?? (await assessTripRisk(trip));
  const output = await generateTravelRiskReport({
    trip,
    documents: context.documents,
    assessment: activeAssessment,
    advisories: context.advisories,
    events: context.events,
    sourceList: context.sources
  });
  const recommendation: TripReport['recommendation'] = activeAssessment.recommendation;
  const report: TripReport = {
    id: randomUUID(),
    tripId: trip.id,
    title: `Atlas Insight - ${trip.name} Operational Risk Report`,
    markdown: output.markdown,
    recommendation,
    createdAt: new Date().toISOString()
  };
  const saved = await store.saveReport(report);

  if (isNeonConfigured()) {
    await query(
      `insert into ai_report_runs (trip_id, report_id, provider, model, prompt_version, grounded_source_count, status, error)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [trip.id, saved.id, output.provider || aiStatus().provider, output.model || aiStatus().model, 'atlas-trip-report-v1', output.groundedSourceCount, output.status, output.error ?? null]
    ).catch(() => []);
  }

  return { report: saved, assessment: activeAssessment, ai: output };
}
