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

export const demoCountryBaselineProvider: CountryBaselineProvider = {
  key: 'demo-country-baseline',
  async getCountries() {
    return { status: 'demo', data: countries, source: 'Demo baseline provider', notes: 'Replace with REST Countries, World Bank/UN, and CIA-style ingestion.' };
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
