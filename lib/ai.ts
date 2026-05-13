import type { Alert, Trip, TripDocument } from './types';
import type { AtlasRiskResult, RouteSegmentRisk } from './risk-engine';

export type AiResult = {
  configured: boolean;
  provider: string;
  model: string;
  sourceStatus: 'ai_generated' | 'manual_fallback';
  confidence: 'Low' | 'Medium' | 'High';
  text: string;
  sources: string[];
  error?: string;
};

export type AiReportOutput = AiResult & { markdown: string; status: 'ai_generated' | 'fallback'; groundedSourceCount: number };

function missingKey(value?: string) {
  const key = value?.trim().toLowerCase();
  return !key || ['replace-me', 'changeme', 'your-key-here'].includes(key);
}

export function aiStatus() {
  const provider = process.env.AI_PROVIDER || 'openai';
  const key = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  const mock = process.env.AI_MOCK_MODE === 'true';
  const ollama = provider === 'ollama';
  return {
    configured: ollama || !missingKey(key) || mock,
    mock,
    provider,
    model: process.env.AI_REPORT_MODEL || process.env.OLLAMA_TRAVEL_MODEL || process.env.AI_MODEL || (ollama ? 'atlas-travel-risk' : 'gpt-4.1-mini'),
    status: ollama ? 'Ollama provider configured' : !missingKey(key) ? 'AI provider configured' : mock ? 'AI mock mode active' : 'AI extraction unavailable - manual entry required'
  };
}

function fallback(text: string, sources: string[] = []): AiResult {
  const status = aiStatus();
  return { configured: false, provider: status.provider, model: status.model, sourceStatus: 'manual_fallback', confidence: 'Low', text, sources };
}

async function callOpenAi(system: string, user: string): Promise<string> {
  const status = aiStatus();
  if (status.mock) return `AI mock mode: ${user.slice(0, 1200)}`;
  if (status.provider === 'ollama') {
    const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: status.model,
        stream: false,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      })
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    const json = await response.json();
    return String(json.message?.content ?? '');
  }
  const key = process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
  if (missingKey(key)) throw new Error('AI key missing');
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: status.model, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
  const json = await response.json();
  return String(json.choices?.[0]?.message?.content ?? '');
}

function groundedSystem() {
  return 'You are Atlas Insight, a travel risk intelligence assistant. Use UK English. Only summarise and assess from supplied source data. Separate confirmed information, inferred assessment and intelligence gaps. Do not invent live facts. Keep output concise, operational and source-grounded.';
}

export async function summarizeCountry(input: { country: string; sourcedFacts: string[] }): Promise<AiResult> {
  const status = aiStatus();
  if (!status.configured) return fallback('AI summary unavailable. Showing sourced provider/demo intelligence without generated analysis.', input.sourcedFacts);
  try {
    const text = await callOpenAi(groundedSystem(), `Country: ${input.country}\nSources:\n${input.sourcedFacts.join('\n')}`);
    return { configured: true, provider: status.provider, model: status.model, sourceStatus: 'ai_generated', confidence: 'Medium', text, sources: input.sourcedFacts };
  } catch (error) {
    return { ...fallback('AI summary failed; deterministic fallback active.', input.sourcedFacts), error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export async function generateCountryBrief(input: { country: string; facts: string[] }) { return summarizeCountry({ country: input.country, sourcedFacts: input.facts }); }
export async function generateCityBrief(input: { city: string; facts: string[] }) { return summarizeCountry({ country: input.city, sourcedFacts: input.facts }); }

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
  const status = aiStatus();
  if (!status.configured) return fallback(`AI extraction unavailable - manual entry required for ${fileName}.`, [fileName]);
  return { configured: true, provider: status.provider, model: status.model, sourceStatus: status.mock ? 'manual_fallback' : 'ai_generated', confidence: 'Medium', text: `Document extraction scaffold ready for ${fileName}. Extract only dates, names, locations and booking references visible in uploaded/source data.`, sources: [fileName] };
}

export async function generateItineraryRiskAssessment(input: { trip: Trip; assessment: AtlasRiskResult; sources: string[] }): Promise<AiResult> {
  const status = aiStatus();
  if (!status.configured) return fallback(`Deterministic assessment: ${input.assessment.level} (${input.assessment.score}/100). Key drivers: ${input.assessment.keyDrivers.join('; ') || 'baseline profile'}.`, input.sources);
  try {
    const text = await callOpenAi(groundedSystem(), JSON.stringify({ trip: input.trip, assessment: input.assessment, sources: input.sources }, null, 2));
    return { configured: true, provider: status.provider, model: status.model, sourceStatus: 'ai_generated', confidence: input.assessment.confidence, text, sources: input.sources };
  } catch (error) {
    return { ...fallback('AI itinerary assessment failed; deterministic assessment used.', input.sources), error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export async function generateReportNarrative(sources: string[]): Promise<AiResult> {
  if (!aiStatus().configured) return fallback('Report narrative uses deterministic Atlas Insight templates because AI is not configured.', sources);
  return { configured: true, provider: aiStatus().provider, model: aiStatus().model, sourceStatus: 'ai_generated', confidence: 'Medium', text: 'AI narrative scaffold active. Generated text must cite supplied provider sources and state limitations.', sources };
}

export async function generateVisualReportExecutiveSummary(input: {
  destination: string;
  score: number | null;
  level: string;
  recommendation: string;
  confidence: string;
  keyReason: string;
  advisory: string;
  missingData: string[];
  sourceSummary: string[];
}): Promise<AiResult> {
  const status = aiStatus();
  const sources = input.sourceSummary.filter(Boolean);
  if (!status.configured) return fallback('AI visual report summary unavailable; deterministic executive summary used.', sources);
  try {
    const text = await callOpenAi(
      `${groundedSystem()} Write no more than five concise lines. Use formal UK English. Do not add facts, events, hotel names, emergency numbers or advisories not present in the supplied cleaned visual report model. Do not output JSON.`,
      JSON.stringify({
        destination: input.destination,
        risk: { score: input.score, level: input.level, recommendation: input.recommendation, confidence: input.confidence },
        keyReason: input.keyReason,
        advisory: input.advisory,
        missingData: input.missingData.slice(0, 8),
        sourceSummary: sources.slice(0, 8)
      }, null, 2)
    );
    return { configured: true, provider: status.provider, model: status.model, sourceStatus: 'ai_generated', confidence: 'Medium', text, sources };
  } catch (error) {
    return { ...fallback('AI visual report summary failed; deterministic executive summary used.', sources), error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export async function generateVisualReportNarratives(input: {
  destination: string;
  score: number | null;
  level: string;
  recommendation: string;
  confidence: string;
  executivePosition: string;
  principalJudgement: string;
  operationalImpact: string;
  requiredControlsSummary: string;
  confidenceNarrative: string;
  finalRationale: string;
  keyDrivers: string[];
  missingData: string[];
  sourceSummary: string[];
}): Promise<AiResult> {
  const status = aiStatus();
  const sources = input.sourceSummary.filter(Boolean);
  if (!status.configured) return fallback('AI visual report narrative polish unavailable; deterministic narrative used.', sources);
  try {
    const text = await callOpenAi(
      `${groundedSystem()} Return JSON only with keys executivePosition, principalJudgement, operationalImpact, requiredControlsSummary, confidenceNarrative and finalRationale. Use formal UK English. Use only supplied facts. Do not invent events, advisories, hotels, emergency contacts or scores. Do not include markdown. Each value must be professional sentences, no bullets, maximum 120 words. If evidence is weak, state the confidence limitation.`,
      JSON.stringify({
        destination: input.destination,
        risk: { score: input.score, level: input.level, recommendation: input.recommendation, confidence: input.confidence },
        currentNarrative: {
          executivePosition: input.executivePosition,
          principalJudgement: input.principalJudgement,
          operationalImpact: input.operationalImpact,
          requiredControlsSummary: input.requiredControlsSummary,
          confidenceNarrative: input.confidenceNarrative,
          finalRationale: input.finalRationale
        },
        keyDrivers: input.keyDrivers.slice(0, 6),
        missingData: input.missingData.slice(0, 8),
        sourceSummary: sources.slice(0, 8)
      }, null, 2)
    );
    return { configured: true, provider: status.provider, model: status.model, sourceStatus: 'ai_generated', confidence: 'Medium', text, sources };
  } catch (error) {
    return { ...fallback('AI visual report narrative polish failed; deterministic narrative used.', sources), error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export async function generateTravelRiskReport(input: { trip: Trip; documents: TripDocument[]; assessment: AtlasRiskResult & { routeRisks?: RouteSegmentRisk[]; itineraryRisks?: Record<string, unknown> }; advisories: Alert[]; events: Alert[]; sourceList: string[] }): Promise<AiReportOutput> {
  const status = aiStatus();
  const sourceList = Array.from(new Set(input.sourceList));
  const routeLines = (input.assessment.routeRisks ?? []).map((route) => `- ${route.segmentName}: ${route.level} (${route.score}/100). ${route.mitigation}`).join('\n') || '- Limited route data available.';
  const fallbackMarkdown = `# Atlas Insight Travel Risk Report\n\n## Executive Summary\n${input.trip.name} is assessed as **${input.assessment.level} (${input.assessment.score}/100)**. Recommendation: **${input.assessment.recommendation}**.\n\n## Trip Overview\nDestination: ${input.trip.locations[0]?.city}, ${input.trip.locations[0]?.country}. Dates: ${input.trip.locations[0]?.arrivalDate} to ${input.trip.locations[0]?.departureDate}. Purpose: ${input.trip.traveller.purpose}.\n\n## Overall Risk Rating\n${input.assessment.level} (${input.assessment.score}/100). Confidence: ${input.assessment.confidence}.\n\n## Itinerary Risk Rating\n${JSON.stringify(input.assessment.itineraryRisks ?? {}, null, 2)}\n\n## Country Risk\nCountry risk is reflected in the overall score and key risk drivers.\n\n## City Risk\nCity-level data is included where available; otherwise the report states limited verified data.\n\n## Route and Transport Risk\n${routeLines}\n\n## Flight / Airport / Border Disruption\nReview flight status, airport advisories and border requirements within 24 hours of departure.\n\n## Accommodation Risk\n${input.trip.accommodation || 'Accommodation not supplied.'}\n\n## Health and Medical\nReview traveller medical factors, insurance, medication availability and evacuation triggers.\n\n## Emergency Services\nConfirm local emergency numbers, private medical access, insurer assistance and embassy/consulate contacts.\n\n## Local Law and Cultural Notes\nBrief travellers on local law, documentation, photography restrictions and cultural expectations.\n\n## Current Advisories\n${input.advisories.map((item) => `- ${item.severity}: ${item.title} - ${item.summary}`).join('\n') || 'No live advisories connected; demo/public fallback only.'}\n\n## Latest Relevant Events\n${input.events.map((item) => `- ${item.severity}: ${item.title} - ${item.summary}`).join('\n') || 'No matching events available.'}\n\n## Traveller Profile Considerations\nStyle: ${input.trip.traveller.travelStyle}. High profile: ${input.trip.traveller.highProfile ? 'yes' : 'no'}. Medical: ${input.trip.traveller.medicalConsiderations || 'none declared'}.\n\n## Documents Checklist\nUploaded: ${input.documents.map((doc) => doc.type).join(', ') || 'None supplied'}.\n\n## Key Risk Drivers\n${input.assessment.keyDrivers.map((driver) => `- ${driver}`).join('\n') || '- Baseline profile only.'}\n\n## Mitigation Advice\nUse controls aligned to the route risk, traveller profile and advisory position.\n\n## Source List\n${sourceList.map((source) => `- ${source}`).join('\n') || '- Demo fallback'}\n\n## Data Freshness\nStatus: ${input.assessment.freshness.status}. ${input.assessment.freshness.notes.join(' ')}\n\n## Intelligence Gaps\n${input.assessment.missingData.map((item) => `- ${item}`).join('\n') || '- None identified.'}\n\n## Final Recommendation\n${input.assessment.recommendation}.`;

  if (!status.configured) return { ...fallback('AI unavailable; deterministic Atlas Insight report generated.', sourceList), markdown: fallbackMarkdown, status: 'fallback', groundedSourceCount: sourceList.length };
  try {
    const generated = await callOpenAi(groundedSystem(), `Create the requested Atlas Insight report structure in markdown using only this JSON.\n${JSON.stringify({ trip: input.trip, assessment: input.assessment, advisories: input.advisories, events: input.events, documents: input.documents, sourceList }, null, 2)}`);
    return { configured: true, provider: status.provider, model: status.model, sourceStatus: 'ai_generated', confidence: input.assessment.confidence, text: 'AI-generated source-grounded report.', markdown: generated || fallbackMarkdown, status: 'ai_generated', groundedSourceCount: sourceList.length, sources: sourceList };
  } catch (error) {
    return { ...fallback('AI report failed; deterministic Atlas Insight report generated.', sourceList), markdown: fallbackMarkdown, status: 'fallback', groundedSourceCount: sourceList.length, error: error instanceof Error ? error.message : 'unknown error' };
  }
}

export function recommendOperationalSupport(score: number, highProfile: boolean) {
  if (score >= 85) return ['Avoid travel / postpone travel', 'Close protection', 'On-ground medic', 'Medical evacuation planning'];
  if (score >= 70 || highProfile) return ['Secure transport', 'Close protection review', 'Remote medic'];
  if (score >= 50) return ['Vetted driver', 'Secure transport', 'Enhanced awareness'];
  return ['Standard precautions'];
}
