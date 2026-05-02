import { NextResponse } from 'next/server';
import { alerts } from '@/lib/data';

export async function GET() {
  return NextResponse.json({ data: alerts.filter((alert) => ['Travel disruption', 'Security', 'Conflict'].includes(alert.category)), sourcePolicy: 'Official advisory adapters are defined but not configured.' });
}
