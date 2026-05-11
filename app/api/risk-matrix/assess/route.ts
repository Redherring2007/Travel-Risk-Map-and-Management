import { NextResponse } from 'next/server';
import { calculateRiskMatrix, validateRiskMatrixInput } from '@/lib/risk-matrix-engine';
import { isNeonConfigured, query } from '@/lib/neon';

async function persistAssessment(matrix: ReturnType<typeof calculateRiskMatrix>) {
  if (!isNeonConfigured()) return { persisted: false, reason: 'Neon not configured.' };
  try {
    const rows = await query<{ id: string }>(
      `insert into risk_matrix_assessments (industry, activity, location, context, overall_residual_score, highest_residual_level, summary, source_evidence, confidence)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
       returning id`,
      [matrix.industry, matrix.activity ?? null, matrix.location ?? null, matrix.context ?? null, matrix.summary.highestResidualScore, matrix.summary.highestResidualLevel, JSON.stringify(matrix.summary), JSON.stringify(matrix.sourceEvidence ?? []), matrix.summary.confidence]
    );
    const assessmentId = rows[0]?.id;
    if (assessmentId) {
      for (const item of matrix.items) {
        await query(
          `insert into risk_matrix_items (assessment_id, industry, hazard, threat, vulnerability, affected_assets, persons_at_risk, likelihood, impact, exposure, existing_controls, inherent_score, inherent_level, residual_likelihood, residual_impact, residual_score, residual_level, recommended_controls, control_owner, review_date, legal_compliance_notes, source_evidence, confidence, assumptions, intelligence_gaps, raw_payload)
           values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, nullif($20, '')::date, $21, $22::jsonb, $23, $24::jsonb, $25::jsonb, $26::jsonb)`,
          [assessmentId, item.industry, item.hazard, item.threat, item.vulnerability, JSON.stringify(item.affectedAssets), JSON.stringify(item.personsAtRisk), item.likelihood, item.impact, item.exposure, JSON.stringify(item.existingControls), item.inherentScore, item.inherentLevel, item.residualLikelihood, item.residualImpact, item.residualScore, item.residualLevel, JSON.stringify(item.recommendedControls), item.controlOwner, item.reviewDate, item.legalComplianceNotes, JSON.stringify(item.sourceEvidence), item.confidence, JSON.stringify(item.assumptions), JSON.stringify(item.intelligenceGaps), JSON.stringify(item)]
        );
      }
    }
    return { persisted: true, assessmentId };
  } catch (error) {
    return { persisted: false, reason: error instanceof Error ? error.message : 'Persistence failed.' };
  }
}

export async function POST(request: Request) {
  const body = await request.json();
  const validation = validateRiskMatrixInput(body);
  if (!validation.valid) return NextResponse.json({ error: validation.errors }, { status: 400 });
  const matrix = calculateRiskMatrix(body);
  const persistence = await persistAssessment(matrix);
  return NextResponse.json({ data: matrix, persistence });
}
