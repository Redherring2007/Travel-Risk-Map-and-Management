import { NextResponse } from 'next/server';
import { searchCountries } from '@/lib/data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json({ data: searchCountries(searchParams.get('q') ?? '') });
}
