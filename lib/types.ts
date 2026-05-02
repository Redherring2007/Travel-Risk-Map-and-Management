export type RiskLevel = 'Low' | 'Moderate' | 'High' | 'Critical';
export type Confidence = 'Low' | 'Medium' | 'High';

export type RiskCategory =
  | 'security'
  | 'crime'
  | 'political'
  | 'terrorismConflict'
  | 'kidnapExtortion'
  | 'health'
  | 'medical'
  | 'naturalDisaster'
  | 'transport'
  | 'infrastructure'
  | 'legalCultural'
  | 'travelDisruption';

export type RiskScore = {
  category: RiskCategory | 'overall';
  value: number;
  level: RiskLevel;
  meaning: string;
  confidence: Confidence;
  lastUpdated: string;
  sources: string[];
};

export type CountryProfile = {
  iso2: string;
  iso3: string;
  name: string;
  capital: string;
  region: string;
  population: string;
  governmentType: string;
  languages: string[];
  currency: string;
  timeZones: string[];
  entryVisaNotes: string;
  securityOverview: string;
  crimeOverview: string;
  terrorismConflictOverview: string;
  kidnapExtortionRisk: string;
  politicalStability: string;
  protestCivilUnrestRisk: string;
  healthRisks: string;
  hygieneWaterFoodSafety: string;
  medicalCapability: string;
  emergencyServicesCapability: string;
  naturalHazards: string;
  transportInfrastructureRisk: string;
  airportTravelDisruptionRisk: string;
  localLawsCulture: string;
  areasToAvoid: string[];
  recommendation: string;
  verifiedDataStatus: string;
  risk: RiskScore[];
};

export type CityProfile = {
  id: string;
  countryIso2: string;
  name: string;
  lat: number;
  lon: number;
  overview: string;
  limitedData: boolean;
  risk: RiskScore[];
};

export type Alert = {
  id: string;
  title: string;
  country: string;
  city?: string;
  category: string;
  severity: RiskLevel;
  source: string;
  timestamp: string;
  summary: string;
  recommendedAction: string;
  linkedTripId?: string;
  approved?: boolean;
};

export type TravellerProfile = {
  nationality: string;
  gender: string;
  travelStyle: 'solo' | 'family' | 'corporate' | 'executive';
  highProfile: boolean;
  medicalConsiderations: string;
  riskTolerance: 'low' | 'medium' | 'high';
  purpose: string;
  childrenTravelling: boolean;
  hostileEnvironmentSupport: boolean;
};

export type TripLocation = {
  countryIso2: string;
  country: string;
  city: string;
  arrivalDate: string;
  departureDate: string;
};

export type TripDocument = {
  id: string;
  tripId: string;
  type: string;
  fileName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  storagePath?: string;
  demoContent?: string;
};

export type Trip = {
  id: string;
  userId: string;
  paid: boolean;
  name: string;
  traveller: TravellerProfile;
  locations: TripLocation[];
  accommodation: string;
  flightDetails: string;
  internalMovements: string;
  meetingsEvents: string;
  createdAt: string;
  updatedAt: string;
};

export type TripReport = {
  id: string;
  tripId: string;
  title: string;
  markdown: string;
  createdAt: string;
  recommendation: 'Go' | 'Go With Caution' | 'Avoid';
};
