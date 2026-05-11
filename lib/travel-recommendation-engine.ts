import type { Confidence, Trip, TripDocument } from './types';
import type { HotelSafetyScore } from './hotel-safety';
import type { OperationalRouteRisk } from './route-risk';
import type { MergedCountryProfile } from './country-profile-merge';

export type TravelRecommendationOutput = {
  missingFields: string[];
  recommendedActions: string[];
  hotelRecommendations: string[];
  routeRecommendations: string[];
  medicalRecommendations: string[];
  embassyRecommendations: string[];
  operationalSupport: string[];
  intelligenceGaps: string[];
  sourceSummary: string[];
  confidence: Confidence;
};

const requiredDocumentTypes = ['passport metadata', 'visa', 'flights', 'hotel booking', 'insurance', 'medical documents', 'emergency contacts'];

export function detectMissingTripComponents(trip: Trip, documents: TripDocument[] = []) {
  const primary = trip.locations[0];
  const uploaded = new Set(documents.map((doc) => doc.type.toLowerCase()));
  const missing: string[] = [];
  if (!primary?.country) missing.push('destination country');
  if (!primary?.city) missing.push('destination city');
  if (!primary?.arrivalDate) missing.push('arrival date');
  if (!primary?.departureDate) missing.push('departure date');
  if (!trip.traveller?.nationality) missing.push('traveller nationality');
  if (!trip.traveller?.gender) missing.push('traveller gender/context');
  if (!trip.traveller?.travelStyle) missing.push('traveller type');
  if (!trip.traveller?.purpose) missing.push('travel purpose');
  if (!trip.accommodation) missing.push('accommodation / hotel');
  if (!trip.flightDetails) missing.push('flight details / airport transfer');
  if (!trip.internalMovements) missing.push('internal movement routes');
  if (!trip.meetingsEvents) missing.push('meetings / event locations');
  if (!/night|late|arrival time|\d{1,2}:\d{2}/i.test(`${trip.flightDetails} ${trip.internalMovements}`)) missing.push('arrival time / night movement exposure');
  for (const docType of requiredDocumentTypes) if (!uploaded.has(docType)) missing.push(`document: ${docType}`);
  return Array.from(new Set(missing));
}

export function recommendHotelOptions(hotelSafety: HotelSafetyScore[]) {
  if (!hotelSafety.length) return ['No hotel candidates are available from OSM/Nominatim. Add accommodation manually or ingest scoped OSM POI data before relying on hotel recommendations.'];
  return hotelSafety.slice().sort((a, b) => a.score - b.score).slice(0, 5).map((hotel) => `${hotel.hotelName}: ${hotel.level} (${hotel.score}/100). Strengths: ${hotel.strengths.join('; ') || 'Limited verified data available.'} Controls: ${hotel.recommendedControls.join('; ')} Source confidence: ${hotel.confidence}. ${hotel.reviewDataNote}`);
}

export function recommendHotelAreas(profile: MergedCountryProfile) {
  const hospitals = profile.pois.filter((poi) => /hospital|medical|clinic/i.test(poi.poiType)).slice(0, 3).map((poi) => poi.name);
  const police = profile.pois.filter((poi) => /police|security/i.test(poi.poiType)).slice(0, 3).map((poi) => poi.name);
  const airports = profile.pois.filter((poi) => /airport/i.test(poi.poiType)).slice(0, 2).map((poi) => poi.name);
  const notes = ['Prefer hotels with controlled access, reliable transport pickup, and ability to support late check-in.'];
  if (hospitals.length) notes.push(`Consider proximity to medical POI candidates: ${hospitals.join(', ')}.`);
  if (police.length) notes.push(`Consider areas with nearby police/security POI candidates: ${police.join(', ')}.`);
  if (airports.length) notes.push(`Balance airport access against city-centre meeting exposure. Airport candidates: ${airports.join(', ')}.`);
  if (!profile.pois.length) notes.push('Limited verified POI data available; manually verify safer districts and transfer routes.');
  return notes;
}

export function recommendMovementControls(routeRisk: OperationalRouteRisk[]) {
  if (!routeRisk.length) return ['Movement details are missing; add airport, hotel, meeting and internal route details before final assessment.'];
  return routeRisk.map((segment) => `${segment.segmentName}: ${segment.level} (${segment.score}/100). ${segment.mitigation} Recommended window: ${segment.recommendedMovementWindow}.`);
}

export function recommendMedicalSupport(profile: MergedCountryProfile, trip: Trip, routeRisk: OperationalRouteRisk[]) {
  const medicalPois = profile.pois.filter((poi) => /hospital|clinic|medical/i.test(poi.poiType)).slice(0, 5);
  const recommendations: string[] = [];
  if (medicalPois.length) recommendations.push(`Nearby medical POI candidates from ${medicalPois[0].source}: ${medicalPois.map((poi) => poi.name).join(', ')}. Verify capability before travel.`);
  else recommendations.push('Medical support context is limited. Identify hospitals/clinics and insurer assistance before departure.');
  if (trip.traveller.medicalConsiderations && !/none/i.test(trip.traveller.medicalConsiderations)) recommendations.push('Traveller medical factors are declared; confirm medication availability, insurance coverage and escalation plan.');
  if (routeRisk.some((segment) => segment.medicalSupportRecommended)) recommendations.push('Route risk indicates remote medic or medical support planning may be advisable.');
  return recommendations;
}

export function recommendEmbassySupport(profile: MergedCountryProfile) {
  const embassies = profile.pois.filter((poi) => /embassy|consulate/i.test(poi.poiType)).slice(0, 5);
  if (!embassies.length) return ['Embassy/consular context unavailable from free-source POI data. Add embassy contacts manually before travel.'];
  return [`Embassy/consulate POI candidates available: ${embassies.map((poi) => poi.name).join(', ')}. Verify official contact details before travel.`];
}

export function recommendOperationalSupport(input: { trip: Trip; score: number; routeRisk: OperationalRouteRisk[]; hotelSafety: HotelSafetyScore[] }) {
  const support: string[] = [];
  if (input.score >= 75) support.push('Avoid travel / postpone travel unless mission-essential and specialist-supported.');
  if (input.score >= 60 || input.routeRisk.some((segment) => segment.secureTransportRecommended)) support.push('Secure transport recommended.');
  if (input.score >= 70 || input.trip.traveller.highProfile || input.routeRisk.some((segment) => segment.closeProtectionRecommended)) support.push('Close protection review advised.');
  if (input.routeRisk.some((segment) => segment.medicalSupportRecommended)) support.push('Remote medic or medical escalation planning advised.');
  if (input.score >= 55) support.push('Medical evacuation planning and insurance validation advised.');
  if (input.hotelSafety.some((hotel) => hotel.score >= 60)) support.push('Accommodation security review advised before confirming hotel.');
  return support.length ? Array.from(new Set(support)) : ['No additional support required beyond standard travel precautions and alert monitoring.'];
}

export function recommendMissingTripData(missingFields: string[]) {
  return missingFields.map((field) => {
    if (field.includes('hotel') || field.includes('accommodation')) return 'Add accommodation details or select a candidate hotel for safety scoring.';
    if (field.includes('airport') || field.includes('flight')) return 'Add arrival/departure airport, flight times and transfer plan to assess airport-route exposure.';
    if (field.includes('arrival time')) return 'Add arrival time. Night-arrival risk cannot be fully assessed without it.';
    if (field.includes('internal movement')) return 'Add internal routes, expected timings and transport mode.';
    if (field.includes('insurance')) return 'Add insurance details and medical evacuation cover status.';
    if (field.includes('medical')) return 'Add medical document/considerations so support planning can be assessed.';
    return `Complete missing field: ${field}.`;
  });
}

export function buildTripPlanningChecklist(input: { trip: Trip; documents: TripDocument[]; profile: MergedCountryProfile; hotelSafety: HotelSafetyScore[]; routeRisk: OperationalRouteRisk[]; score: number }): TravelRecommendationOutput {
  const missingFields = detectMissingTripComponents(input.trip, input.documents);
  const hotelRecommendations = [...recommendHotelAreas(input.profile), ...recommendHotelOptions(input.hotelSafety)];
  const routeRecommendations = recommendMovementControls(input.routeRisk);
  const medicalRecommendations = recommendMedicalSupport(input.profile, input.trip, input.routeRisk);
  const embassyRecommendations = recommendEmbassySupport(input.profile);
  const operationalSupport = recommendOperationalSupport({ trip: input.trip, score: input.score, routeRisk: input.routeRisk, hotelSafety: input.hotelSafety });
  const recommendedActions = Array.from(new Set([...recommendMissingTripData(missingFields), ...operationalSupport]));
  const sourceSummary = Array.from(new Set([
    ...input.profile.sources.map((source) => `${source.source} (${source.status}; ${source.confidence})`),
    input.profile.pois.length ? `OSM/Nominatim POI candidates: ${input.profile.pois.length}` : 'No OSM/Nominatim POI candidates available',
    input.profile.hotels.length ? `Hotel candidates: ${input.profile.hotels.length}` : 'No hotel candidates available'
  ]));
  const confidence: Confidence = input.profile.confidence === 'High' && missingFields.length <= 3 ? 'High' : input.profile.confidence === 'Low' || missingFields.length > 8 ? 'Low' : 'Medium';
  return { missingFields, recommendedActions, hotelRecommendations, routeRecommendations, medicalRecommendations, embassyRecommendations, operationalSupport, intelligenceGaps: input.profile.intelligenceGaps, sourceSummary, confidence };
}
