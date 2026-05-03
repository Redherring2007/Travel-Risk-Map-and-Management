import { NextResponse } from 'next/server';
import { aiStatus } from '@/lib/ai';

export async function GET() {
  return NextResponse.json(aiStatus());
}
