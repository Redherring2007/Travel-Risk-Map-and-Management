import { NextResponse } from 'next/server';
import { generateIndustryTemplate, riskMatrixIndustries } from '@/lib/risk-matrix-engine';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const industry = searchParams.get('industry') ?? 'security';
  return NextResponse.json({ data: generateIndustryTemplate(industry), industries: riskMatrixIndustries });
}
