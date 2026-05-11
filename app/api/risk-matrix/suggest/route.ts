import { NextResponse } from 'next/server';
import { generateRiskMatrixSuggestions } from '@/lib/ai';
import { calculateRiskMatrix, generateIndustryTemplate, suggestControlsForIndustry } from '@/lib/risk-matrix-engine';

type SuggestBody = {
  industry?: string;
  activity?: string;
  location?: string;
  context?: string;
  knownHazards?: string[];
  existingControls?: string[];
  sourceEvidence?: string[];
};

function deterministicDraft(body: SuggestBody) {
  const template = generateIndustryTemplate(body.industry);
  const hazards = (body.knownHazards?.length ? body.knownHazards : template.hazards.slice(0, 3).map((item) => item.hazard)).map((hazard) => ({
    hazard,
    likelihood: 3,
    impact: 3,
    exposure: 3,
    existingControls: body.existingControls ?? [],
    recommendedControls: suggestControlsForIndustry(template.industry, hazard),
    sourceEvidence: body.sourceEvidence ?? [],
    assumptions: ['Initial deterministic draft. Validate likelihood and impact with a competent assessor before operational use.'],
    intelligenceGaps: body.sourceEvidence?.length ? [] : ['No source evidence supplied for AI-assisted suggestion.']
  }));
  return calculateRiskMatrix({ industry: template.industry, activity: body.activity, location: body.location, context: body.context, items: hazards, sourceEvidence: body.sourceEvidence ?? [] });
}

export async function POST(request: Request) {
  const body = (await request.json()) as SuggestBody;
  const matrix = deterministicDraft(body);
  const ai = await generateRiskMatrixSuggestions({
    industry: matrix.industry,
    activity: body.activity,
    location: body.location,
    context: body.context,
    knownHazards: matrix.items.map((item) => item.hazard),
    existingControls: body.existingControls ?? [],
    sourceEvidence: body.sourceEvidence ?? [],
    deterministicMatrix: matrix
  });
  return NextResponse.json({ data: { matrix, ai, template: generateIndustryTemplate(matrix.industry) } });
}
