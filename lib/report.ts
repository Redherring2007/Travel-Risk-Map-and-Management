import { randomUUID } from 'crypto';
import { cities, findCountry } from './data';
import { recommendationFromScore } from './risk-engine';
import type { Trip, TripDocument, TripReport } from './types';

const requiredDocuments = ['Passport', 'Visa', 'Tickets', 'Hotel booking', 'Insurance', 'Medical documents', 'Emergency contacts'];

function supportAdvice(overall: number) {
  if (overall >= 85) return ['Avoid travel / postpone travel', 'Close protection advised', 'Armed protection advised where legal and appropriate', 'On-ground medic advised', 'Medical evacuation planning advised'];
  if (overall >= 70) return ['Close protection advised', 'Secure transport recommended', 'Remote medic advised', 'Medical evacuation planning advised'];
  if (overall >= 50) return ['Secure transport recommended', 'Vetted driver recommended', 'Enhanced awareness advised', 'Remote medic advised'];
  if (overall >= 25) return ['Enhanced awareness advised', 'Vetted driver recommended for unfamiliar areas'];
  return ['No additional support required'];
}

export function missingDocuments(documents: TripDocument[]) {
  const uploaded = new Set(documents.map((doc) => doc.type.toLowerCase()));
  return requiredDocuments.filter((type) => !uploaded.has(type.toLowerCase()));
}

export function generateTripReport(trip: Trip, documents: TripDocument[]): TripReport {
  const primary = trip.locations[0];
  const country = findCountry(primary?.countryIso2 ?? primary?.country ?? 'GB') ?? findCountry('GB')!;
  const city = cities.find((item) => item.countryIso2 === country.iso2 && item.name.toLowerCase() === primary?.city.toLowerCase());
  const overall = country.risk.find((risk) => risk.category === 'overall')!;
  const recommendation = recommendationFromScore(overall.value);
  const missing = missingDocuments(documents);
  const support = supportAdvice(overall.value);

  const markdown = `# Atlas Insight Risk Map and Travel Management\n\n` +
    `## ${trip.name} Travel Risk Report\n\n` +
    `Generated: ${new Date().toISOString()}\n\n` +
    `## 1. Executive Summary\nTravel to ${primary?.city || country.capital}, ${country.name} is assessed as **${overall.level} (${overall.value}/100)**. Recommendation: **${recommendation}**.\n\n` +
    `## 2. Overall Risk Rating\n${overall.meaning}\nConfidence: ${overall.confidence}. Source status: ${overall.sourceStatus}. Sources: ${overall.sources.join(', ')}.\n\n` +
    `## 3. Destination Overview\nCapital: ${country.capital}. Region: ${country.region}. Population: ${country.population}. Government: ${country.governmentType}. Languages: ${country.languages.join(', ')}. Currency: ${country.currency}. Time zone: ${country.timeZones.join(', ')}.\n\n` +
    `## 4. City-Level Risk\n${city ? city.overview : 'Limited verified city data available. Use country profile and provider-backed city feeds when connected.'}\n\n` +
    `## 5. Route and Movement Risk\n${trip.internalMovements || 'No internal movement plan supplied.'}\n\n` +
    `## 6. Accommodation Risk\n${trip.accommodation || 'No accommodation supplied. Use vetted hotels and confirm secure transport access.'}\n\n` +
    `## 7. Airport and Transport Risk\n${country.airportTravelDisruptionRisk} ${country.transportInfrastructureRisk}\n\n` +
    `## 8. Security Risk\n${country.securityOverview}\n\n` +
    `## 9. Crime and Kidnap Risk\n${country.crimeOverview} ${country.kidnapExtortionRisk}\n\n` +
    `## 10. Political and Civil Unrest Risk\n${country.politicalStability} ${country.protestCivilUnrestRisk}\n\n` +
    `## 11. Terrorism/Conflict Risk\n${country.terrorismConflictOverview}\n\n` +
    `## 12. Health and Hygiene\n${country.healthRisks}\n\n` +
    `## 13. Food and Water Safety\n${country.hygieneWaterFoodSafety}\n\n` +
    `## 14. Medical Capability\n${country.medicalCapability}\n\n` +
    `## 15. Emergency Services Assessment\nPolice reliability: ${country.emergencyServicesCapability}\nAmbulance reliability: ${country.emergencyServicesCapability}\nHospital quality: ${country.medicalCapability}\nEmergency response limitations: Capability varies by location and incident scale.\nPrivate medical support recommended: ${overall.value >= 50 ? 'Yes' : 'Usually not required'}\nRemote medic support recommended: ${overall.value >= 45 ? 'Yes' : 'No'}\nClose protection recommended: ${overall.value >= 70 || trip.traveller.highProfile ? 'Yes' : 'No'}\nArmed protection where legal: ${overall.value >= 85 ? 'Consider only where lawful and specialist-advised' : 'No'}\nSecure transport / armoured vehicle: ${overall.value >= 60 ? 'Secure transport recommended; armoured vehicle only after local threat review' : 'No'}\n\n` +
    `## 16. Natural Hazards\n${country.naturalHazards}\n\n` +
    `## 17. Legal and Cultural Considerations\n${country.localLawsCulture}\n\n` +
    `## 18. Digital/Cyber Travel Risk\nUse device hygiene, VPN, MFA, and avoid sensitive work on public Wi-Fi. High-profile and executive travellers should use hardened devices.\n\n` +
    `## 19. Documents Checklist\nUploaded: ${documents.map((doc) => `${doc.type} (${doc.storageKey})`).join(', ') || 'None'}\nMissing: ${missing.join(', ') || 'None'}\n\n` +
    `## 20. Emergency Contacts\nEnsure insurer, employer, embassy/consulate, local emergency numbers, and hotel contacts are saved offline.\n\n` +
    `## 21. Recommended Precautions\n${support.map((item) => `- ${item}`).join('\n')}\n\n` +
    `## 22. Security Support Recommendation\n${support.filter((item) => !item.toLowerCase().includes('medic')).join('; ')}\n\n` +
    `## 23. Medical Support Recommendation\n${support.filter((item) => item.toLowerCase().includes('medic') || item.toLowerCase().includes('medical')).join('; ') || 'Standard travel medical preparation.'}\n\n` +
    `## 24. Final Recommendation\n${recommendation}.\n`;

  return { id: randomUUID(), tripId: trip.id, title: `Atlas Insight - ${trip.name} Risk Report`, markdown, createdAt: new Date().toISOString(), recommendation };
}
