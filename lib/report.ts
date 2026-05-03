import { randomUUID } from 'crypto';
import { alerts, cities, findCountry } from './data';
import { generateReportNarrative, recommendOperationalSupport } from './ai';
import { recommendationFromScore } from './risk-engine';
import type { Trip, TripDocument, TripReport } from './types';

const requiredDocuments = ['passport metadata', 'visa', 'flights', 'hotel booking', 'insurance', 'medical documents', 'emergency contacts'];

export function missingDocuments(documents: TripDocument[]) {
  const uploaded = new Set(documents.map((doc) => doc.type.toLowerCase()));
  return requiredDocuments.filter((type) => !uploaded.has(type.toLowerCase()));
}

function sourceLine(sources: string[], status: string, confidence: string, lastUpdated: string) {
  return `Source: ${sources.join(', ')} | Status: ${status} | Confidence: ${confidence} | Last updated: ${lastUpdated}`;
}

function missingTripFields(trip: Trip) {
  const primary = trip.locations[0];
  const fields: string[] = [];
  if (!primary?.country) fields.push('destination country');
  if (!primary?.city) fields.push('destination city');
  if (!primary?.arrivalDate) fields.push('arrival date');
  if (!primary?.departureDate) fields.push('departure date');
  if (!trip.accommodation) fields.push('accommodation');
  if (!trip.flightDetails) fields.push('flight details');
  if (!trip.internalMovements) fields.push('internal movements/routes');
  if (!trip.meetingsEvents) fields.push('meetings/events');
  if (!trip.traveller?.nationality) fields.push('traveller nationality');
  if (!trip.traveller?.purpose) fields.push('travel purpose');
  return fields;
}

export function generateTripReport(trip: Trip, documents: TripDocument[]): TripReport {
  const primary = trip.locations[0];
  const country = findCountry(primary?.countryIso2 ?? primary?.country ?? 'GB') ?? findCountry('GB')!;
  const city = cities.find((item) => item.countryIso2 === country.iso2 && item.name.toLowerCase() === primary?.city.toLowerCase());
  const overall = country.risk.find((risk) => risk.category === 'overall')!;
  const recommendation = recommendationFromScore(overall.value);
  const missingDocs = missingDocuments(documents);
  const missingFields = missingTripFields(trip);
  const support = recommendOperationalSupport(overall.value, trip.traveller.highProfile);
  const linkedAlerts = alerts.filter((alert) => alert.country === country.name || alert.city === primary?.city);
  const narrative = 'AI-assisted narrative is disabled unless AI_API_KEY is configured. This report uses deterministic Atlas Insight templates and cites underlying demo/public/provider sources.';

  const markdown = `# Atlas Insight Risk Map and Travel Management\n\n` +
    `## ${trip.name} Travel Risk Report\n\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `Data integrity: Risk/advisory/event intelligence is source-labelled. Demo fallback data must be replaced with live provider/admin-verified data before production operational reliance.\n\n` +
    `AI status: ${narrative}\n\n` +
    `## 1. Executive Summary\nTravel to ${primary?.city || country.capital}, ${country.name} from ${primary?.arrivalDate || 'date not supplied'} to ${primary?.departureDate || 'date not supplied'} is assessed as **${overall.level} (${overall.value}/100)**. Recommendation: **${recommendation}**.\n\n` +
    `Key issue: ${overall.value >= 75 ? country.terrorismConflictOverview : overall.value >= 50 ? country.crimeOverview : country.naturalHazards}\n\n` +
    `${sourceLine(overall.sources, overall.sourceStatus, overall.confidence, overall.lastUpdated)}\n\n` +
    `## 2. Missing Data To Complete\nTrip fields missing: ${missingFields.join(', ') || 'None'}\nDocuments missing: ${missingDocs.join(', ') || 'None'}\n\n` +
    `## 3. Overall Risk Rating\n${overall.meaning}\n${sourceLine(overall.sources, overall.sourceStatus, overall.confidence, overall.lastUpdated)}\n\n` +
    `## 4. Destination Overview\nCapital: ${country.capital}. Region: ${country.region}. Population: ${country.population}. Government: ${country.governmentType}. Languages: ${country.languages.join(', ')}. Currency: ${country.currency}. Time zone: ${country.timeZones.join(', ')}.\n\n` +
    `## 5. City-Level Risk\n${city ? city.overview : 'Limited verified city data available. Use country profile and provider-backed city feeds when connected.'}\n${city ? sourceLine(city.risk[0].sources, city.risk[0].sourceStatus, city.risk[0].confidence, city.risk[0].lastUpdated) : 'Source: none | Status: limited | Confidence: Low | Last updated: not available'}\n\n` +
    `## 6. Route and Movement Risk\nFlights: ${trip.flightDetails || 'No flight details supplied.'}\nInternal movements: ${trip.internalMovements || 'No internal movement plan supplied.'}\nMeetings/events: ${trip.meetingsEvents || 'No meetings or events supplied.'}\n\n` +
    `## 7. Accommodation Risk\n${trip.accommodation || 'No accommodation supplied. Use vetted hotels and confirm secure transport access.'}\n\n` +
    `## 8. Airport and Transport Risk\n${country.airportTravelDisruptionRisk} ${country.transportInfrastructureRisk}\n\n` +
    `## 9. Security Risk\n${country.securityOverview}\n\n` +
    `## 10. Crime and Kidnap Risk\n${country.crimeOverview} ${country.kidnapExtortionRisk}\n\n` +
    `## 11. Political and Civil Unrest Risk\n${country.politicalStability} ${country.protestCivilUnrestRisk}\n\n` +
    `## 12. Terrorism/Conflict Risk\n${country.terrorismConflictOverview}\n\n` +
    `## 13. Health and Hygiene\n${country.healthRisks}\n\n` +
    `## 14. Food and Water Safety\n${country.hygieneWaterFoodSafety}\n\n` +
    `## 15. Medical Capability\n${country.medicalCapability}\n\n` +
    `## 16. Emergency Services Assessment\nPolice reliability: ${country.emergencyServicesCapability}\nAmbulance reliability: ${country.emergencyServicesCapability}\nHospital quality: ${country.medicalCapability}\nEmergency response limitations: Capability varies by location and incident scale.\nPrivate medical support recommended: ${overall.value >= 50 ? 'Yes' : 'Usually not required'}\nRemote medic support recommended: ${overall.value >= 45 ? 'Yes' : 'No'}\nClose protection recommended: ${overall.value >= 70 || trip.traveller.highProfile ? 'Yes' : 'No'}\nArmed protection where legal: ${overall.value >= 85 ? 'Consider only where lawful and specialist-advised' : 'No'}\nSecure transport / armoured vehicle: ${overall.value >= 60 ? 'Secure transport recommended; armoured vehicle only after local threat review' : 'No'}\n\n` +
    `## 17. Natural Hazards\n${country.naturalHazards}\n\n` +
    `## 18. Legal and Cultural Considerations\n${country.localLawsCulture}\n\n` +
    `## 19. Current Advisories and Events\n${linkedAlerts.length ? linkedAlerts.map((alert) => `- ${alert.severity}: ${alert.title} (${alert.country}${alert.city ? `, ${alert.city}` : ''}) - ${alert.summary} | Source: ${alert.source} | Status: demo fallback | Time: ${alert.timestamp}`).join('\n') : 'No linked live/provider advisories available. Demo/public fallback only.'}\n\n` +
    `## 20. Digital/Cyber Travel Risk\nUse device hygiene, VPN, MFA, and avoid sensitive work on public Wi-Fi. High-profile and executive travellers should use hardened devices.\n\n` +
    `## 21. Documents Checklist\nUploaded: ${documents.map((doc) => `${doc.type} (${doc.storageKey})`).join(', ') || 'None'}\nMissing: ${missingDocs.join(', ') || 'None'}\n\n` +
    `## 22. Emergency Contacts\nEnsure insurer, employer, embassy/consulate, local emergency numbers, and hotel contacts are saved offline.\n\n` +
    `## 23. Recommended Precautions\n${support.map((item) => `- ${item}`).join('\n')}\n\n` +
    `## 24. Operational Support Recommendation\nSecurity support: ${support.filter((item) => !item.toLowerCase().includes('medic') && !item.toLowerCase().includes('medical')).join('; ') || 'Standard precautions.'}\nMedical support: ${support.filter((item) => item.toLowerCase().includes('medic') || item.toLowerCase().includes('medical')).join('; ') || 'Standard travel medical preparation.'}\n\n` +
    `## 25. Final Recommendation\n${recommendation}.\n`;

  void generateReportNarrative(overall.sources);
  return { id: randomUUID(), tripId: trip.id, title: `Atlas Insight - ${trip.name} Risk Report`, markdown, createdAt: new Date().toISOString(), recommendation };
}
