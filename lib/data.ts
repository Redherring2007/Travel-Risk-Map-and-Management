import { overallRisk, score } from './risk-engine';
import type { Alert, CityProfile, CountryProfile } from './types';

function countryRisk(values: number[], sources: string[]) {
  const categories = [
    'security', 'crime', 'political', 'terrorismConflict', 'kidnapExtortion', 'health',
    'medical', 'naturalDisaster', 'transport', 'infrastructure', 'legalCultural', 'travelDisruption'
  ] as const;
  const scores = categories.map((category, index) => score(category, values[index] ?? 35, sources, 'Medium'));
  return [overallRisk(scores), ...scores];
}

export const countries: CountryProfile[] = [
  {
    iso2: 'GB', iso3: 'GBR', name: 'United Kingdom', capital: 'London', region: 'Europe', population: '67.7 million', governmentType: 'Parliamentary constitutional monarchy', languages: ['English'], currency: 'GBP', timeZones: ['UTC', 'UTC+1 seasonal'],
    entryVisaNotes: 'Verify visa requirements by nationality before travel. ETA requirements may apply to some travellers.',
    securityOverview: 'Generally stable security environment with persistent terrorism and public order considerations in major cities.',
    crimeOverview: 'Most visits are trouble-free. Petty crime and phone theft are more common in dense urban and tourist areas.',
    terrorismConflictOverview: 'Terrorism threat remains present; follow official police and government guidance.',
    kidnapExtortionRisk: 'Low for most travellers.', politicalStability: 'Stable institutions with occasional disruptive protest activity.', protestCivilUnrestRisk: 'Usually localized and manageable; transport disruption can occur.',
    healthRisks: 'Routine health risks. Seasonal respiratory illness and occasional industrial action can affect healthcare access.', hygieneWaterFoodSafety: 'Tap water and food hygiene standards are generally high.', medicalCapability: 'High medical capability, though waiting times vary.', emergencyServicesCapability: 'Reliable police, ambulance, and fire response.',
    naturalHazards: 'Flooding, storms, and winter disruption are the main natural hazards.', transportInfrastructureRisk: 'Mature infrastructure with periodic rail, road, and airport disruption.', airportTravelDisruptionRisk: 'Strikes, weather, and congestion can affect major airports.',
    localLawsCulture: 'Respect public order laws, knife laws, and photography restrictions around sensitive sites.', areasToAvoid: ['Localized protest or police cordon areas'], recommendation: 'Standard precautions and itinerary monitoring are usually sufficient.', verifiedDataStatus: 'Demo profile based on public baseline/advisory categories; connect providers for live production intelligence.',
    risk: countryRisk([22, 28, 18, 32, 12, 20, 18, 18, 24, 20, 18, 30], ['Demo baseline', 'Advisory adapter pending'])
  },
  {
    iso2: 'FR', iso3: 'FRA', name: 'France', capital: 'Paris', region: 'Europe', population: '68.2 million', governmentType: 'Semi-presidential republic', languages: ['French'], currency: 'EUR', timeZones: ['UTC+1', 'UTC+2 seasonal'],
    entryVisaNotes: 'Schengen entry rules apply. Check visa and passport validity requirements by nationality.', securityOverview: 'Stable but with meaningful terrorism, protest, and urban crime considerations.', crimeOverview: 'Petty theft, scams, and opportunistic crime occur in major tourist and transport hubs.', terrorismConflictOverview: 'Terrorism threat persists; official alert posture may change quickly.', kidnapExtortionRisk: 'Low for ordinary travellers.', politicalStability: 'Stable governance with periodic nationwide demonstrations and strikes.', protestCivilUnrestRisk: 'Moderate; protests can disrupt Paris and major transport corridors.', healthRisks: 'Routine European health risk profile.', hygieneWaterFoodSafety: 'Generally high standards.', medicalCapability: 'High medical capability in major cities.', emergencyServicesCapability: 'Reliable, with possible surge limitations during major incidents.', naturalHazards: 'Heatwaves, flooding, and wildfire risk in some regions.', transportInfrastructureRisk: 'Strong infrastructure; strike disruption can be material.', airportTravelDisruptionRisk: 'Labour action and congestion can affect flights.', localLawsCulture: 'Observe protest exclusion zones and identity documentation requirements.', areasToAvoid: ['Active protest zones', 'Police cordons'], recommendation: 'Travel is generally acceptable with protest and transport monitoring.', verifiedDataStatus: 'Demo profile; provider-backed advisories required for production use.', risk: countryRisk([34, 38, 30, 44, 16, 18, 18, 24, 34, 25, 20, 42], ['Demo baseline', 'Advisory adapter pending'])
  },
  {
    iso2: 'KE', iso3: 'KEN', name: 'Kenya', capital: 'Nairobi', region: 'Africa', population: '55.1 million', governmentType: 'Presidential republic', languages: ['English', 'Swahili'], currency: 'KES', timeZones: ['UTC+3'],
    entryVisaNotes: 'Electronic travel authorization requirements apply for many travellers. Confirm before departure.', securityOverview: 'Variable security environment with crime, terrorism, protest, and border-area risks.', crimeOverview: 'Street crime, vehicle crime, and robbery risks are elevated in parts of Nairobi and coastal areas.', terrorismConflictOverview: 'Terrorism risk exists, especially near Somalia border and some coastal locations.', kidnapExtortionRisk: 'Moderate in higher-risk border and remote areas.', politicalStability: 'Generally functional institutions, with election and cost-of-living protest risk.', protestCivilUnrestRisk: 'Can escalate quickly; avoid gatherings.', healthRisks: 'Malaria and other vector-borne disease risks in some regions; vaccine review recommended.', hygieneWaterFoodSafety: 'Use bottled/treated water and cautious food hygiene practices.', medicalCapability: 'Good private capability in Nairobi; limited capability outside major centres.', emergencyServicesCapability: 'Response quality varies; private support may be advisable.', naturalHazards: 'Flooding, drought, and road disruption are recurring hazards.', transportInfrastructureRisk: 'Road safety risk is material; use vetted transport.', airportTravelDisruptionRisk: 'Operational disruption possible but major airports are generally functional.', localLawsCulture: 'Observe photography restrictions and local cultural norms.', areasToAvoid: ['Somalia border areas', 'Active protest areas', 'Isolated travel after dark'], recommendation: 'Enhanced planning, vetted drivers, and medical contingency planning advised.', verifiedDataStatus: 'Demo profile; connect advisory and incident providers before client production use.', risk: countryRisk([58, 62, 50, 62, 48, 52, 45, 45, 60, 52, 40, 48], ['Demo baseline', 'Advisory adapter pending'])
  },
  {
    iso2: 'UA', iso3: 'UKR', name: 'Ukraine', capital: 'Kyiv', region: 'Europe', population: '36.7 million', governmentType: 'Semi-presidential republic', languages: ['Ukrainian'], currency: 'UAH', timeZones: ['UTC+2', 'UTC+3 seasonal'],
    entryVisaNotes: 'Check wartime entry requirements, insurance, and consular guidance before any travel.', securityOverview: 'Active conflict creates severe security, infrastructure, and travel disruption risk.', crimeOverview: 'Crime risk is secondary to conflict but rises during outages/displacement.', terrorismConflictOverview: 'Active armed conflict and missile/drone threat in many regions.', kidnapExtortionRisk: 'Elevated in contested or occupied areas.', politicalStability: 'Government functions under wartime conditions.', protestCivilUnrestRisk: 'Civil unrest risk is not primary; conflict disruption dominates.', healthRisks: 'Healthcare disruption, trauma care constraints, and medicine access issues possible.', hygieneWaterFoodSafety: 'Infrastructure damage may affect water and sanitation.', medicalCapability: 'Variable and degraded by conflict pressures.', emergencyServicesCapability: 'Emergency response may be delayed or unavailable in affected areas.', naturalHazards: 'Winter weather and infrastructure damage amplify risk.', transportInfrastructureRisk: 'High. Airspace restrictions, damaged infrastructure, and checkpoints affect movement.', airportTravelDisruptionRisk: 'Commercial aviation severely restricted.', localLawsCulture: 'Martial-law restrictions and curfews may apply.', areasToAvoid: ['Frontline areas', 'Occupied territories', 'Recent strike locations'], recommendation: 'Avoid non-essential travel; specialist security and medical support required for essential movement.', verifiedDataStatus: 'Demo profile; production use requires live official/security provider feeds.', risk: countryRisk([88, 70, 75, 92, 72, 70, 72, 55, 90, 88, 65, 95], ['Demo baseline', 'Advisory adapter pending'])
  },
  {
    iso2: 'JP', iso3: 'JPN', name: 'Japan', capital: 'Tokyo', region: 'Asia', population: '124.5 million', governmentType: 'Parliamentary constitutional monarchy', languages: ['Japanese'], currency: 'JPY', timeZones: ['UTC+9'],
    entryVisaNotes: 'Visa-free or visa requirements vary by nationality; confirm before travel.', securityOverview: 'Low crime and stable security environment.', crimeOverview: 'Low crime rates; petty crime is uncommon but still possible in entertainment areas.', terrorismConflictOverview: 'Low terrorism and conflict risk.', kidnapExtortionRisk: 'Low.', politicalStability: 'Stable.', protestCivilUnrestRisk: 'Low and typically orderly.', healthRisks: 'Routine risks; heat stress during summer can be significant.', hygieneWaterFoodSafety: 'High standards; tap water is generally safe.', medicalCapability: 'High medical capability, though language support may vary.', emergencyServicesCapability: 'Reliable and capable.', naturalHazards: 'Earthquakes, tsunamis, typhoons, and volcanic activity are key risks.', transportInfrastructureRisk: 'Excellent infrastructure with weather or seismic disruption risk.', airportTravelDisruptionRisk: 'Typhoons and earthquakes can disrupt airports.', localLawsCulture: 'Strict drug laws and public conduct expectations apply.', areasToAvoid: ['Disaster exclusion zones when active'], recommendation: 'Standard precautions with natural hazard readiness.', verifiedDataStatus: 'Demo profile; connect live weather/seismic feeds for production.', risk: countryRisk([12, 10, 10, 10, 5, 18, 16, 48, 14, 12, 18, 28], ['Demo baseline', 'Advisory adapter pending'])
  }
];

export const cities: CityProfile[] = [
  { id: 'london-gb', countryIso2: 'GB', name: 'London', lat: 51.5072, lon: -0.1276, overview: 'Major global city with strong emergency capability; monitor terrorism posture, protests, and petty crime hotspots.', limitedData: false, risk: countryRisk([25, 34, 18, 36, 10, 18, 16, 16, 26, 18, 18, 32], ['Demo city baseline']) },
  { id: 'paris-fr', countryIso2: 'FR', name: 'Paris', lat: 48.8566, lon: 2.3522, overview: 'High-capability city with elevated petty crime, protest disruption, and terrorism awareness requirements.', limitedData: false, risk: countryRisk([38, 46, 32, 45, 14, 18, 18, 18, 35, 24, 20, 42], ['Demo city baseline']) },
  { id: 'nairobi-ke', countryIso2: 'KE', name: 'Nairobi', lat: -1.2921, lon: 36.8219, overview: 'Commercial hub with elevated road safety, crime, protest, and terrorism considerations; vetted transport recommended.', limitedData: false, risk: countryRisk([62, 66, 52, 60, 45, 48, 44, 35, 64, 50, 38, 46], ['Demo city baseline']) },
  { id: 'kyiv-ua', countryIso2: 'UA', name: 'Kyiv', lat: 50.4501, lon: 30.5234, overview: 'Capital operating under wartime threat conditions. Air alerts, missile/drone strikes, and infrastructure disruption are material.', limitedData: false, risk: countryRisk([82, 62, 70, 86, 62, 64, 66, 42, 82, 78, 58, 90], ['Demo city baseline']) },
  { id: 'tokyo-jp', countryIso2: 'JP', name: 'Tokyo', lat: 35.6762, lon: 139.6503, overview: 'Very low crime city with excellent infrastructure; natural hazard readiness is the main planning requirement.', limitedData: false, risk: countryRisk([10, 8, 8, 8, 4, 16, 16, 46, 12, 10, 16, 24], ['Demo city baseline']) }
];

export const alerts: Alert[] = [
  { id: 'a1', title: 'Rail and airport strike disruption possible', country: 'France', city: 'Paris', category: 'Travel disruption', severity: 'Moderate', source: 'Demo advisory adapter', timestamp: new Date().toISOString(), summary: 'Transport unions have announced potential disruption affecting rail and airport transfers.', recommendedAction: 'Build extra transfer time and confirm flights before departure.', approved: true },
  { id: 'a2', title: 'Avoid border-area travel', country: 'Kenya', category: 'Security', severity: 'High', source: 'Demo advisory adapter', timestamp: new Date().toISOString(), summary: 'Border-adjacent areas carry elevated terrorism and kidnap risk.', recommendedAction: 'Avoid non-essential travel and use vetted local security advice.', approved: true },
  { id: 'a3', title: 'Air alerts and infrastructure strikes continue', country: 'Ukraine', city: 'Kyiv', category: 'Conflict', severity: 'Critical', source: 'Demo live incident adapter', timestamp: new Date().toISOString(), summary: 'Missile and drone threats continue to affect movement and business continuity.', recommendedAction: 'Avoid travel unless essential and supported by specialist providers.', approved: false },
  { id: 'a4', title: 'Typhoon season preparedness', country: 'Japan', city: 'Tokyo', category: 'Natural hazard', severity: 'Moderate', source: 'Demo weather adapter', timestamp: new Date().toISOString(), summary: 'Seasonal weather systems may disrupt flights and rail.', recommendedAction: 'Monitor weather alerts and keep flexible travel plans.', approved: true }
];

export function findCountry(query: string) {
  const normalized = query.trim().toLowerCase();
  return countries.find((country) => country.iso2.toLowerCase() === normalized || country.iso3.toLowerCase() === normalized || country.name.toLowerCase() === normalized);
}

export function searchCountries(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return countries;
  return countries.filter((country) => [country.name, country.iso2, country.iso3, country.capital, country.region].some((value) => value.toLowerCase().includes(normalized)));
}

export function searchCities(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return cities;
  return cities.filter((city) => city.name.toLowerCase().includes(normalized) || city.countryIso2.toLowerCase().includes(normalized));
}
