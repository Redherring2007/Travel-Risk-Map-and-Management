import { riskLevel } from './risk-engine';
import type { Alert, Confidence, RiskLevel, Trip } from './types';
import type { MergedCountryProfile } from './country-profile-merge';

export type OperationalRouteRisk = {
  segmentName: string;
  from?: string;
  to?: string;
  score: number;
  level: RiskLevel;
  drivers: string[];
  mitigation: string;
  recommendedMovementWindow: string;
  secureTransportRecommended: boolean;
  closeProtectionRecommended: boolean;
  medicalSupportRecommended: boolean;
  confidence: Confidence;
  sourceSummary: string[];
};

function containsNight(text: string) {
  return /(night|late|after dark|23:|00:|01:|02:|03:|04:|05:)/i.test(text);
}

function segmentScore(base: number, text: string, trip: Trip, events: Alert[]) {
  let value = base;
  const drivers: string[] = [];
  if (/airport|border|arrival|departure|flight/i.test(text)) { value += 5; drivers.push('Airport/border movement exposure'); }
  if (/road|drive|transfer|vehicle|route/i.test(text)) { value += 7; drivers.push('Ground transport exposure'); }
  if (/meeting|event|client|dinner|public/i.test(text)) { value += 5; drivers.push('Meeting/event exposure'); }
  if (containsNight(text)) { value += 10; drivers.push('Night or low-visibility movement exposure'); }
  if (trip.traveller.highProfile) { value += 8; drivers.push('High-profile traveller exposure'); }
  if (trip.traveller.childrenTravelling) { value += 5; drivers.push('Children travelling'); }
  if (trip.traveller.hostileEnvironmentSupport) { value += 6; drivers.push('Hostile-environment support flag'); }
  const relevantEvents = events.filter((event) => ['High', 'Critical'].includes(event.severity)).slice(0, 3);
  if (relevantEvents.length) { value += Math.min(12, relevantEvents.length * 4); drivers.push('Recent high/critical relevant events'); }
  return { score: Math.min(100, Math.round(value)), drivers: drivers.length ? drivers : ['Baseline movement exposure'] };
}

function mitigationFor(score: number, drivers: string[]) {
  const controls = ['Confirm route and timings before departure', 'Maintain charged phone and traveller check-in plan'];
  if (score >= 45) controls.push('Use vetted driver or pre-booked transfer');
  if (score >= 60) controls.push('Use secure transport, avoid ad hoc taxis and avoid unscheduled stops');
  if (score >= 70) controls.push('Consider close protection review for executive or public movements');
  if (drivers.some((driver) => /night/i.test(driver))) controls.push('Avoid night movement where possible');
  return controls.join('; ') + '.';
}

export function assessRouteRisk(input: { trip: Trip; countryRiskScore: number; cityRiskScore?: number; mergedProfile?: MergedCountryProfile }): OperationalRouteRisk[] {
  const { trip, mergedProfile } = input;
  const primary = trip.locations[0];
  const base = Math.max(input.countryRiskScore, input.cityRiskScore ?? 0, 20);
  const events = mergedProfile?.events ?? [];
  const sourceSummary = [
    ...(mergedProfile?.sources ?? []).map((source) => `${source.source} (${source.status}; ${source.confidence})`),
    events.length ? 'Recent advisories/events linked to destination' : 'No recent event context available'
  ];
  const segments = [
    { segmentName: 'Airport to hotel', from: 'Arrival airport', to: trip.accommodation || 'Hotel not supplied', text: `${trip.flightDetails} ${trip.accommodation}` },
    { segmentName: 'Hotel to meeting', from: trip.accommodation || 'Hotel not supplied', to: trip.meetingsEvents || 'Meeting location not supplied', text: `${trip.internalMovements} ${trip.meetingsEvents}` },
    { segmentName: 'Meeting to hotel', from: trip.meetingsEvents || 'Meeting location not supplied', to: trip.accommodation || 'Hotel not supplied', text: `${trip.internalMovements} ${trip.meetingsEvents}` },
    { segmentName: 'Hotel to airport', from: trip.accommodation || 'Hotel not supplied', to: 'Departure airport', text: `${trip.flightDetails} ${trip.internalMovements}` },
    { segmentName: 'Internal movements', from: primary?.city, to: primary?.city, text: trip.internalMovements || 'Internal movements not supplied' }
  ];
  return segments.map((segment) => {
    const scored = segmentScore(base, segment.text, trip, events);
    const level = riskLevel(scored.score);
    return {
      segmentName: segment.segmentName,
      from: segment.from,
      to: segment.to,
      score: scored.score,
      level,
      drivers: scored.drivers,
      mitigation: mitigationFor(scored.score, scored.drivers),
      recommendedMovementWindow: containsNight(segment.text) || scored.score >= 60 ? 'Daylight / business-hours movement preferred' : 'Normal operating hours; confirm live alerts before movement',
      secureTransportRecommended: scored.score >= 50,
      closeProtectionRecommended: scored.score >= 72 || (trip.traveller.highProfile && scored.score >= 60),
      medicalSupportRecommended: scored.score >= 65 || Boolean(trip.traveller.medicalConsiderations && trip.traveller.medicalConsiderations.toLowerCase() !== 'none declared'),
      confidence: trip.internalMovements && trip.flightDetails ? mergedProfile?.confidence ?? 'Medium' : 'Low',
      sourceSummary
    };
  });
}
