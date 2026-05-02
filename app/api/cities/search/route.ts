import { NextResponse } from 'next/server';
import { searchCities } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json({ data: searchCities(searchParams.get('q') ?? '') });
}
