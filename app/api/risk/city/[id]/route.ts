import { NextResponse } from 'next/server';
import { cities } from '@/lib/data';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const city = cities.find((item) => item.id === id);
  if (!city) return NextResponse.json({ error: 'City not found' }, { status: 404 });
  return NextResponse.json({ data: city.risk, limitedData: city.limitedData });
}
