import { NextResponse } from 'next/server';
import { countries } from '@/lib/data';

export async function GET() {
  return NextResponse.json({ data: countries, mode: 'demo-provider-ready' });
}
