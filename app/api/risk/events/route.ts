import { NextResponse } from 'next/server';
import { loadRelevantAdvisories, loadRelevantEvents } from '@/lib/source-data';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country') ?? undefined;
  const city = searchParams.get('city') ?? undefined;
  const [events, advisories] = await Promise.all([
    loadRelevantEvents(country, city),
    loadRelevantAdvisories(country)
  ]);
  return NextResponse.json({
    data: events,
    advisories,
    mode: 'neon-or-demo-fallback',
    dataIntegrity: 'Items are returned from Neon when configured; otherwise labelled demo/public fallback data is used.'
  });
}
