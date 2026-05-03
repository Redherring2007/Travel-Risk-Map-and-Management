import { NextResponse } from 'next/server';
import { extractDocumentItineraryData } from '@/lib/ai';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await extractDocumentItineraryData(String(body.fileName ?? 'uploaded document'));
  return NextResponse.json(result);
}
