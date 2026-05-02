import { NextResponse } from 'next/server';
import { cities, countries } from '@/lib/data';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const city = cities.find((item) => item.id === id);
  if (!city) return NextResponse.json({ error: 'City not found' }, { status: 404 });
  const country = countries.find((item) => item.iso2 === city.countryIso2) ?? null;
  return NextResponse.json({ data: { ...city, country }, limitedData: city.limitedData });
}
