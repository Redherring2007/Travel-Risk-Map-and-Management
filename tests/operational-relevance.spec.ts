import { test, expect } from '@playwright/test';
import { scoreEventRelevance } from '../lib/event-relevance';
import { calculateTripRisk } from '../lib/risk-engine';
import type { Alert, CountryProfile, Trip } from '../lib/types';

const now = new Date().toISOString();

function event(overrides: Partial<Alert>): Alert {
  return {
    id: overrides.id ?? 'event',
    title: overrides.title ?? 'Incident',
    country: overrides.country ?? 'Global',
    city: overrides.city,
    category: overrides.category ?? 'Security',
    severity: overrides.severity ?? 'High',
    source: overrides.source ?? 'Official source',
    timestamp: overrides.timestamp ?? now,
    summary: overrides.summary ?? 'Operationally relevant event.',
    recommendedAction: overrides.recommendedAction ?? 'Review controls.',
    approved: true
  };
}

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    userId: 'user-1',
    paid: true,
    name: 'Nairobi visit',
    traveller: {
      nationality: 'British',
      gender: 'Not specified',
      travelStyle: 'executive',
      highProfile: false,
      medicalConsiderations: 'None declared',
      riskTolerance: 'medium',
      purpose: 'Meetings',
      childrenTravelling: false,
      hostileEnvironmentSupport: false
    },
    locations: [{ countryIso2: 'KE', country: 'Kenya', city: 'Nairobi', arrivalDate: '2026-06-10', departureDate: '2026-06-14' }],
    accommodation: 'Business hotel',
    flightDetails: 'Arrival via NBO',
    internalMovements: 'Airport transfer and city meetings',
    meetingsEvents: 'Board meetings',
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

const kenyaProfile = {
  iso2: 'KE',
  risk: [{ category: 'overall', value: 50 }]
} as CountryProfile;

test('Nairobi report excludes Nevada event from scoring relevance', () => {
  const nevada = event({ title: 'Nevada highway incident', country: 'United States', city: 'Nevada', severity: 'Critical', summary: 'Incident in Nevada, United States.' });
  const relevance = scoreEventRelevance(nevada, 'KE', 'Nairobi', 'Arrival via NBO');
  expect(relevance.affectsScoring).toBe(false);
  expect(relevance.exclusionReason).toContain('Unrelated US state');
});

test('global event does not affect destination score', () => {
  const global = event({ title: 'Global earthquake monitoring update', country: 'Global', category: 'Natural hazard', severity: 'Critical', summary: 'Worldwide seismic monitoring update.' });
  const result = calculateTripRisk({ trip: trip(), country: kenyaProfile, events: [global], sourceSummary: [{ source: 'Official source', status: 'live', confidence: 'High', lastUpdated: now, records: 1 }] });
  expect(result.dataQualityWarnings.join(' ')).toContain('excluded from scoring');
  expect(result.threatLevel).not.toBe('Critical');
});

test('missing hotel reduces confidence and does not increase threat', () => {
  const complete = calculateTripRisk({ trip: trip(), country: kenyaProfile, events: [], sourceSummary: [{ source: 'Official source', status: 'live', confidence: 'High', lastUpdated: now, records: 1 }] });
  const missingHotel = calculateTripRisk({ trip: trip({ accommodation: '' }), country: kenyaProfile, events: [], sourceSummary: [{ source: 'Official source', status: 'live', confidence: 'High', lastUpdated: now, records: 1 }] });
  expect(missingHotel.threatScore).toBeLessThanOrEqual(complete.threatScore);
  expect(missingHotel.confidenceScore).toBeLessThan(complete.confidenceScore);
});

test('direct Kenya event can affect Kenya score', () => {
  const kenyaEvent = event({ title: 'Nairobi severe security incident', country: 'Kenya', city: 'Nairobi', severity: 'Critical', summary: 'Severe incident in Nairobi, Kenya.' });
  const relevance = scoreEventRelevance(kenyaEvent, 'KE', 'Nairobi');
  expect(relevance.affectsScoring).toBe(true);
  const result = calculateTripRisk({ trip: trip(), country: kenyaProfile, events: [kenyaEvent], sourceSummary: [{ source: 'Official source', status: 'live', confidence: 'High', lastUpdated: now, records: 1 }] });
  expect(result.threatScore).toBeGreaterThan(50);
});
