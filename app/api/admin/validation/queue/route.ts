import { NextResponse } from 'next/server';
import { buildValidationQueue, fallbackValidationCountries, validationArchitecture } from '@/lib/analyst-validation';

export async function GET() {
  const queue = await buildValidationQueue();
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    queue: queue.length ? queue : fallbackValidationCountries(),
    architecture: validationArchitecture(),
    persistence: 'placeholder_only_no_database_writes'
  });
}
