import { NextResponse } from 'next/server';
import { providers } from '@/lib/providers';

export async function GET() {
  return NextResponse.json({ data: providers });
}
