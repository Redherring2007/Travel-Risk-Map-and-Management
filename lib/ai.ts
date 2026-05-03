export type AiResult = {
  configured: boolean;
  provider: string;
  model: string;
  sourceStatus: 'ai_generated' | 'manual_fallback';
  confidence: 'Low' | 'Medium' | 'High';
  text: string;
  sources: string[];
};

export function aiStatus() {
  return {
    configured: Boolean(process.env.AI_API_KEY),
    provider: process.env.AI_PROVIDER || 'Not configured',
    model: process.env.AI_MODEL || 'Not configured',
    status: process.env.AI_API_KEY ? 'AI provider configured' : 'AI extraction unavailable - manual entry required'
  };
}

function fallback(text: string, sources: string[] = []): AiResult {
  const status = aiStatus();
  return { configured: false, provider: status.provider, model: status.model, sourceStatus: 'manual_fallback', confidence: 'Low', text, sources };
}

export async function summarizeCountry(input: { country: string; sourcedFacts: string[] }): Promise<AiResult> {
  if (!aiStatus().configured) return fallback('AI summary unavailable. Showing sourced provider/demo intelligence without generated analysis.', input.sourcedFacts);
  return { configured: true, provider: process.env.AI_PROVIDER || 'AI provider', model: process.env.AI_MODEL || 'configured model', sourceStatus: 'ai_generated', confidence: 'Medium', text: `AI-assisted summary for ${input.country} based only on supplied provider facts.`, sources: input.sourcedFacts };
}

export function countryVisualPrompt(country: string, region: string, riskLevel: string) {
  return `Premium dark intelligence atlas diorama of ${country} in ${region}, low-poly terrain, subtle amber data lights, ${riskLevel} risk atmosphere, no text, original Atlas Insight style`;
}

export function travelMeaningFromScore(score: number) {
  if (score >= 75) return 'Avoid or tightly control travel with specialist security, medical contingency planning, and executive approval.';
  if (score >= 50) return 'Travel is possible with enhanced preparation, vetted movement, live alert monitoring, and clear escalation routes.';
  if (score >= 25) return 'Travel is generally manageable with itinerary awareness, disruption checks, and basic security precautions.';
  return 'Standard travel precautions are usually sufficient; continue monitoring for disruption and local rule changes.';
}

export async function extractDocumentItineraryData(fileName: string): Promise<AiResult> {
  if (!aiStatus().configured) return fallback(`AI extraction unavailable - manual entry required for ${fileName}.`, [fileName]);
  return { configured: true, provider: process.env.AI_PROVIDER || 'AI provider', model: process.env.AI_MODEL || 'configured model', sourceStatus: 'ai_generated', confidence: 'Medium', text: `Document extraction scaffold ready for ${fileName}. Connect a document parser/OCR pipeline before production use.`, sources: [fileName] };
}

export async function generateReportNarrative(sources: string[]): Promise<AiResult> {
  if (!aiStatus().configured) return fallback('Report narrative uses deterministic Atlas Insight templates because AI is not configured.', sources);
  return { configured: true, provider: process.env.AI_PROVIDER || 'AI provider', model: process.env.AI_MODEL || 'configured model', sourceStatus: 'ai_generated', confidence: 'Medium', text: 'AI narrative scaffold active. Generated text must cite the supplied provider sources and state limitations.', sources };
}

export function recommendOperationalSupport(score: number, highProfile: boolean) {
  if (score >= 85) return ['Avoid travel / postpone travel', 'Close protection', 'On-ground medic', 'Medical evacuation planning'];
  if (score >= 70 || highProfile) return ['Secure transport', 'Close protection review', 'Remote medic'];
  if (score >= 50) return ['Vetted driver', 'Secure transport', 'Enhanced awareness'];
  return ['Standard precautions'];
}
