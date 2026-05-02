import { alerts, cities, countries } from './data';
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

function mergeRestCountry(item: RestCountry): CountryProfile | null {
  const existing = countries.find((country) => country.iso2 === item.cca2);
  if (!existing) return null;
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
    verifiedDataStatus: 'Live REST Countries baseline merged with demo intelligence. Advisory/risk feeds still require configured providers.'
  };
}

export const restCountriesProvider: CountryBaselineProvider = {
  key: 'rest-countries-live',
  async getCountries() {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=cca2,cca3,name,capital,region,population,languages,currencies,timezones', { next: { revalidate: 86_400 } });
      if (!response.ok) throw new Error(`REST Countries returned ${response.status}`);
      const data = (await response.json()) as RestCountry[];
      const merged = data.map(mergeRestCountry).filter(Boolean) as CountryProfile[];
      return { status: 'live', data: merged.length ? merged : countries, source: 'REST Countries', notes: merged.length ? 'Live baseline fields merged for supported demo intelligence profiles.' : 'No supported demo profiles matched; using fallback.' };
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
