import { NextResponse } from 'next/server';
import { buildValidationRecord, validationArchitecture, type ValidationSubmission } from '@/lib/analyst-validation';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Partial<ValidationSubmission> | null;
  if (!body?.entityType || !body.entityId || !body.status) {
    return NextResponse.json({ error: 'entityType, entityId and status are required.' }, { status: 400 });
  }
  const record = buildValidationRecord(body as ValidationSubmission);
  return NextResponse.json({
    accepted: true,
    persisted: false,
    record,
    architecture: validationArchitecture(),
    message: 'Validation submission accepted as structured placeholder. Add a database migration before enabling persistence.'
  });
}
