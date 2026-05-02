import { NextResponse } from 'next/server';
import { alerts } from '@/lib/data';

export async function GET() {
  return NextResponse.json({ data: alerts, mode: 'demo-live-incident-adapter' });
}
