import { NextResponse } from 'next/server';
import { providerStatusReport } from '@/lib/provider-status';

export async function GET() {
  return NextResponse.json(providerStatusReport());
}
