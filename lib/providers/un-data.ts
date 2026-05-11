import { fallbackResult, type ProviderResult } from './shared';

export async function fetchUnDataCountryContext(countryIso2?: string): Promise<ProviderResult> {
  return fallbackResult('UN Data context', 'UN_DATA_API_URL', 'UN Data adapter placeholder. Add a specific public UN dataset endpoint before enabling ingestion.', countryIso2, 'un-data');
}
