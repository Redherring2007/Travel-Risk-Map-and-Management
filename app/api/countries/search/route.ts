import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').toLowerCase();
  const result = await restCountriesProvider.getCountries();
  const data = !query ? result.data : result.data.filter((country) => [country.name, country.iso2, country.iso3, country.capital, country.region].some((value) => value.toLowerCase().includes(query)));
  return NextResponse.json({ data, mode: result.status, source: result.source });
}
