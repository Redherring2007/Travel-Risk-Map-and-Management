import { alerts, cities, countries } from './data';
import { score } from './risk-engine';
import type { Alert, CityProfile, CountryProfile } from './types';

export type ProviderResult<T> = {
  status: 'demo' | 'live' | 'not_configured';
  data: T;
  source: string;
  notes?: string;
};

export interface CountryBaselineProvider {
  key: string;
  getCountries(): Promise<ProviderResult<CountryProfile[]>>;
}

export interface TravelAdvisoryProvider {
  key: string;
  getAdvisories(countryIso2?: string): Promise<ProviderResult<Alert[]>>;
}

export interface IncidentProvider {
  key: string;
  getEvents(): Promise<ProviderResult<Alert[]>>;
}

export interface GeocodingProvider {
  key: string;
  searchCities(query: string): Promise<ProviderResult<CityProfile[]>>;
}

type RestCountry = {
  cca2: string;
  cca3: string;
  name: { common: string };
  capital?: string[];
  region?: string;
  population?: number;
  languages?: Record<string, string>;
  currencies?: Record<string, { name: string; symbol?: string }>;
  timezones?: string[];
};

const limitedRisk = [
  score('overall', 35, ['REST Countries public baseline', 'Demo fallback risk model'], 'Low', 'limited'),
  score('security', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('crime', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('political', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('terrorismConflict', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('kidnapExtortion', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('health', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('medical', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('naturalDisaster', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('transport', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('infrastructure', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('legalCultural', 35, ['Demo fallback risk model'], 'Low', 'limited'),
  score('travelDisruption', 35, ['Demo fallback risk model'], 'Low', 'limited')
];

function limitedCountry(item: RestCountry): CountryProfile {
  const existing = countries.find((country) => country.iso2 === item.cca2);
  if (existing) {
    return {
      ...existing,
      iso2: item.cca2,
      iso3: item.cca3,
      name: item.name.common,
      capital: item.capital?.[0] ?? existing.capital,
      region: item.region ?? existing.region,
      population: item.population ? item.population.toLocaleString('en') : existing.population,
      languages: item.languages ? Object.values(item.languages) : existing.languages,
      currency: item.currencies ? Object.keys(item.currencies).join(', ') : existing.currency,
      timeZones: item.timezones ?? existing.timeZones,
      verifiedDataStatus: 'Live REST Countries baseline merged with demo intelligence. Advisory/risk feeds remain demo-labelled until connected.'
    };
  }

  return {
    iso2: item.cca2,
    iso3: item.cca3,
    name: item.name.common,
    capital: item.capital?.[0] ?? 'Limited verified data available',
    region: item.region ?? 'Limited verified data available',
    population: item.population ? item.population.toLocaleString('en') : 'Limited verified data available',
    governmentType: 'Limited verified data available',
    languages: item.languages ? Object.values(item.languages) : ['Limited verified data available'],
    currency: item.currencies ? Object.keys(item.currencies).join(', ') : 'Limited verified data available',
    timeZones: item.timezones ?? ['Limited verified data available'],
    entryVisaNotes: 'Limited verified data available. Connect official advisory providers for entry and visa notes.',
    securityOverview: 'Limited verified data available. Atlas Insight has baseline country facts but no connected live security feed for this country yet.',
    crimeOverview: 'Limited verified data available.',
    terrorismConflictOverview: 'Limited verified data available.',
    kidnapExtortionRisk: 'Limited verified data available.',
    politicalStability: 'Limited verified data available.',
    protestCivilUnrestRisk: 'Limited verified data available.',
    healthRisks: 'Limited verified data available.',
    hygieneWaterFoodSafety: 'Limited verified data available.',
    medicalCapability: 'Limited verified data available.',
    emergencyServicesCapability: 'Limited verified data available.',
    naturalHazards: 'Limited verified data available.',
    transportInfrastructureRisk: 'Limited verified data available.',
    airportTravelDisruptionRisk: 'Limited verified data available.',
    localLawsCulture: 'Limited verified data available.',
    areasToAvoid: ['Limited verified data available'],
    recommendation: 'Use baseline country data only until advisory and incident providers are connected.',
    verifiedDataStatus: 'Live REST Countries public baseline. Risk/advisory/event intelligence is limited demo fallback.',
    risk: limitedRisk
  };
}

export const restCountriesProvider: CountryBaselineProvider = {
  key: 'rest-countries-live',
  async getCountries() {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=cca2,cca3,name,capital,region,population,languages,currencies,timezones', { next: { revalidate: 86_400 } });
      if (!response.ok) throw new Error(`REST Countries returned ${response.status}`);
      const data = (await response.json()) as RestCountry[];
      return { status: 'live', data: data.map(limitedCountry).sort((a, b) => a.name.localeCompare(b.name)), source: 'REST Countries', notes: 'Live public baseline fields. Intelligence fields remain demo/limited unless provider feeds are connected.' };
    } catch (error) {
      return { status: 'demo', data: countries, source: 'Demo baseline provider', notes: error instanceof Error ? error.message : 'REST Countries unavailable; demo fallback active.' };
    }
  }
};

export const demoCountryBaselineProvider: CountryBaselineProvider = {
  key: 'demo-country-baseline',
  async getCountries() {
    return { status: 'demo', data: countries, source: 'Demo baseline provider', notes: 'Replace or enrich with REST Countries, World Bank/UN, and CIA-style ingestion.' };
  }
};

export const demoAdvisoryProvider: TravelAdvisoryProvider = {
  key: 'demo-advisories',
  async getAdvisories(countryIso2?: string) {
    const country = countryIso2 ? countries.find((item) => item.iso2 === countryIso2) : null;
    return { status: 'demo', data: country ? alerts.filter((alert) => alert.country === country.name) : alerts, source: 'Demo advisory provider' };
  }
};

export const demoIncidentProvider: IncidentProvider = {
  key: 'demo-incidents',
  async getEvents() {
    return { status: 'demo', data: alerts, source: 'Demo GDELT/news/weather/health/aviation provider' };
  }
};

export const demoGeocodingProvider: GeocodingProvider = {
  key: 'demo-geocoding',
  async searchCities(query: string) {
    const normalized = query.toLowerCase();
    return { status: 'demo', data: cities.filter((city) => city.name.toLowerCase().includes(normalized) || city.countryIso2.toLowerCase().includes(normalized)), source: 'Demo geocoding provider' };
  }
};
