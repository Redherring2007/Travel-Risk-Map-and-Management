import { NextResponse } from 'next/server';
import { getDemoSession } from '@/lib/auth';

export async function GET(request: Request) {
  return NextResponse.json({ data: getDemoSession(request.headers), mode: 'demo-auth; replace with production auth provider before commercial launch.' });
}
