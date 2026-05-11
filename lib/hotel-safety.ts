import { riskLevel } from './risk-engine';
import type { Alert, Confidence, RiskLevel, TravellerProfile } from './types';
import type { HotelCandidate, LocationPoi, MergedCountryProfile } from './country-profile-merge';

export type HotelSafetyScore = {
  hotelId: string;
  hotelName: string;
  score: number;
  level: RiskLevel;
  strengths: string[];
  concerns: string[];
  recommendedControls: string[];
  verifiedReviewDataAvailable: boolean;
  reviewDataNote: string;
  confidence: Confidence;
  sourceSummary: string[];
};

function distanceKm(a?: { latitude?: number | null; longitude?: number | null }, b?: { latitude?: number | null; longitude?: number | null }) {
  if (!a?.latitude || !a?.longitude || !b?.latitude || !b?.longitude) return null;
  const r = 6371;
  const dLat = (b.latitude - a.latitude) * Math.PI / 180;
  const dLon = (b.longitude - a.longitude) * Math.PI / 180;
  const lat1 = a.latitude * Math.PI / 180;
  const lat2 = b.latitude * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function nearest(hotel: HotelCandidate, pois: LocationPoi[], matcher: RegExp) {
  const candidates = pois.filter((poi) => matcher.test(poi.poiType));
  const distances = candidates.map((poi) => ({ poi, km: distanceKm(hotel, poi) })).filter((item): item is { poi: LocationPoi; km: number } => item.km !== null).sort((a, b) => a.km - b.km);
  return distances[0] ?? null;
}

export function scoreHotelSafety(input: { hotels: HotelCandidate[]; pois: LocationPoi[]; countryRiskScore: number; cityRiskScore?: number; events?: Alert[]; traveller: TravellerProfile; movementNotes?: string }): HotelSafetyScore[] {
  const events = input.events ?? [];
  return input.hotels.slice(0, 12).map((hotel) => {
    let score = Math.max(input.countryRiskScore, input.cityRiskScore ?? 0, 20);
    const strengths: string[] = [];
    const concerns: string[] = [];
    const controls: string[] = ['Confirm booking directly with hotel', 'Use vetted transport for arrivals and departures'];
    const hospital = nearest(hotel, input.pois, /hospital|clinic|medical/i);
    const police = nearest(hotel, input.pois, /police|security/i);
    const embassy = nearest(hotel, input.pois, /embassy|consulate/i);
    const airport = nearest(hotel, input.pois, /airport/i);

    if (hospital && hospital.km <= 8) strengths.push(`Medical facility candidate within ${hospital.km.toFixed(1)} km: ${hospital.poi.name}`);
    else { score += 5; concerns.push('No nearby hospital/medical POI candidate available from free sources.'); }
    if (police && police.km <= 6) strengths.push(`Police/security POI candidate within ${police.km.toFixed(1)} km: ${police.poi.name}`);
    else { score += 4; concerns.push('No nearby police/security POI candidate available from free sources.'); }
    if (embassy && embassy.km <= 12) strengths.push(`Embassy/consulate POI candidate within ${embassy.km.toFixed(1)} km: ${embassy.poi.name}`);
    else concerns.push('Embassy/consulate proximity could not be confirmed from free sources.');
    if (airport && airport.km > 45) { score += 4; concerns.push(`Airport candidate appears ${airport.km.toFixed(1)} km away; transfer exposure may be higher.`); }
    if (/night|after dark|late/i.test(input.movementNotes ?? '')) { score += 7; concerns.push('Arrival or movement notes suggest possible night movement exposure.'); controls.push('Prefer daylight arrival or pre-arranged secure transfer.'); }
    if (input.traveller.highProfile) { score += 7; controls.push('Request discreet arrival process and avoid public lobby waiting.'); }
    if (input.traveller.travelStyle === 'family' || input.traveller.childrenTravelling) controls.push('Confirm family-safe access, room layout and medical support arrangements.');
    if (input.traveller.medicalConsiderations && !/none/i.test(input.traveller.medicalConsiderations)) controls.push('Confirm access to suitable medical support before arrival.');
    const highEvents = events.filter((event) => ['High', 'Critical'].includes(event.severity));
    if (highEvents.length) { score += Math.min(10, highEvents.length * 3); concerns.push('High/critical destination events exist; hotel area must be manually checked against latest alerts.'); }
    score = Math.max(0, Math.min(100, Math.round(score)));
    const coordinateConfidence = hotel.latitude && hotel.longitude ? 1 : 0;
    const confidence: Confidence = coordinateConfidence && input.pois.length >= 3 ? 'Medium' : 'Low';
    return {
      hotelId: hotel.id,
      hotelName: hotel.name,
      score,
      level: riskLevel(score),
      strengths,
      concerns: concerns.length ? concerns : ['No major deterministic concerns identified from available free-source POI context.'],
      recommendedControls: controls,
      verifiedReviewDataAvailable: false,
      reviewDataNote: 'Verified review data unavailable from free sources.',
      confidence,
      sourceSummary: [`Hotel candidate source: ${hotel.source}`, `POI source count: ${input.pois.length}`, 'OSM/Nominatim data is public candidate data and requires operational verification.']
    };
  });
}

export function scoreHotelsForMergedProfile(input: { mergedProfile: MergedCountryProfile; countryRiskScore: number; cityRiskScore?: number; traveller: TravellerProfile; movementNotes?: string }) {
  return scoreHotelSafety({ hotels: input.mergedProfile.hotels, pois: input.mergedProfile.pois, countryRiskScore: input.countryRiskScore, cityRiskScore: input.cityRiskScore, events: input.mergedProfile.events, traveller: input.traveller, movementNotes: input.movementNotes });
}
