import { NextResponse } from 'next/server';
import { generateProviderCoverageAudit } from '@/lib/provider-coverage-audit';

export async function GET() {
  const audit = await generateProviderCoverageAudit();
  return NextResponse.json(audit);
}
