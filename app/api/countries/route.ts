import { NextResponse } from 'next/server';
import { restCountriesProvider } from '@/lib/provider-adapters';

export async function GET() {
  const result = await restCountriesProvider.getCountries();
  return NextResponse.json({ data: result.data, mode: result.status, source: result.source, notes: result.notes });
}
